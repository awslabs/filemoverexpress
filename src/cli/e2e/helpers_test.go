//go:build e2e

package e2e

import (
	"bytes"
	"context"
	"crypto/md5" // #nosec G501 -- compares against the checksum the daemon stores; not a security use
	"encoding/hex"
	"io"
	"math/rand"
	"os"
	"path/filepath"
	"regexp"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/stretchr/testify/require"

	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	s3sharedv1 "github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

const (
	MiB            = 1 << 20
	jobTimeout     = 90 * time.Second
	jobPollEvery   = 200 * time.Millisecond
	rpcTimeout     = 30 * time.Second
	statusComplete = "COMPLETED"
)

var terminalStatuses = map[string]bool{
	"COMPLETED": true, "COMPLETED_WITH_WARNINGS": true, "ERROR": true, "CANCELLED": true,
}

var unsafeName = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

// testEnv is the per-test view of the shared suite. Each test works under its own key prefix and
// its own temporary directory, and its objects are deleted when the test ends.
type testEnv struct {
	*suite
	t      *testing.T
	prefix string // key prefix of this test, ending in "/"
	dir    string // local scratch directory
}

func newTestEnv(t *testing.T) *testEnv {
	t.Helper()
	env := &testEnv{
		suite:  shared,
		t:      t,
		prefix: unsafeName.ReplaceAllString(t.Name(), "_") + "/",
		dir:    t.TempDir(),
	}
	t.Cleanup(env.deleteObjects)
	return env
}

func ctx() context.Context { return context.Background() }

// --- local files ---

// writeFile creates a file of size bytes filled from a seeded generator and returns its MD5.
func (e *testEnv) writeFile(rel string, size int64, seed int64) string {
	e.t.Helper()
	path := filepath.Join(e.dir, filepath.FromSlash(rel))
	require.NoError(e.t, os.MkdirAll(filepath.Dir(path), 0o750))
	f, err := os.Create(path) // #nosec G304 -- inside t.TempDir()
	require.NoError(e.t, err)
	sum := md5.New() // #nosec G401 -- see import comment
	// #nosec G404 -- deterministic test data, not security sensitive
	_, err = io.CopyN(io.MultiWriter(f, sum), rand.New(rand.NewSource(seed)), size)
	require.NoError(e.t, err)
	require.NoError(e.t, f.Close())
	return hex.EncodeToString(sum.Sum(nil))
}

func md5File(t *testing.T, path string) string {
	t.Helper()
	f, err := os.Open(path) // #nosec G304 -- test-controlled path
	require.NoError(t, err)
	defer func() { _ = f.Close() }()
	sum := md5.New() // #nosec G401 -- see import comment
	_, err = io.Copy(sum, f)
	require.NoError(t, err)
	return hex.EncodeToString(sum.Sum(nil))
}

// --- S3 verification (independent of the daemon) ---

func (e *testEnv) key(rel string) string { return e.prefix + rel }

func (e *testEnv) put(rel string, data []byte) {
	e.t.Helper()
	_, err := e.s3.PutObject(ctx(), &s3.PutObjectInput{
		Bucket: aws.String(e.bucket), Key: aws.String(e.key(rel)), Body: bytes.NewReader(data),
	})
	require.NoError(e.t, err)
}

func (e *testEnv) head(rel string) *s3.HeadObjectOutput {
	e.t.Helper()
	out, err := e.s3.HeadObject(ctx(), &s3.HeadObjectInput{Bucket: aws.String(e.bucket), Key: aws.String(e.key(rel))})
	require.NoError(e.t, err, "object %s should exist", e.key(rel))
	return out
}

func (e *testEnv) exists(rel string) bool {
	_, err := e.s3.HeadObject(ctx(), &s3.HeadObjectInput{Bucket: aws.String(e.bucket), Key: aws.String(e.key(rel))})
	return err == nil
}

// objectMD5 downloads an object and returns the MD5 of its content.
func (e *testEnv) objectMD5(rel string) string {
	e.t.Helper()
	out, err := e.s3.GetObject(ctx(), &s3.GetObjectInput{Bucket: aws.String(e.bucket), Key: aws.String(e.key(rel))})
	require.NoError(e.t, err)
	defer func() { _ = out.Body.Close() }()
	sum := md5.New() // #nosec G401 -- see import comment
	_, err = io.Copy(sum, out.Body)
	require.NoError(e.t, err)
	return hex.EncodeToString(sum.Sum(nil))
}

// keys lists every key under this test's prefix, relative to it.
func (e *testEnv) keys() []string {
	e.t.Helper()
	var keys []string
	p := s3.NewListObjectsV2Paginator(e.s3, &s3.ListObjectsV2Input{
		Bucket: aws.String(e.bucket), Prefix: aws.String(e.prefix),
	})
	for p.HasMorePages() {
		page, err := p.NextPage(ctx())
		require.NoError(e.t, err)
		for _, o := range page.Contents {
			keys = append(keys, (*o.Key)[len(e.prefix):])
		}
	}
	return keys
}

func (e *testEnv) deleteObjects() {
	p := s3.NewListObjectsV2Paginator(e.s3, &s3.ListObjectsV2Input{
		Bucket: aws.String(e.bucket), Prefix: aws.String(e.prefix),
	})
	for p.HasMorePages() {
		page, err := p.NextPage(ctx())
		if err != nil {
			return
		}
		for _, o := range page.Contents {
			_, _ = e.s3.DeleteObject(ctx(), &s3.DeleteObjectInput{Bucket: aws.String(e.bucket), Key: o.Key})
		}
	}
}

func lastModified(out *s3.HeadObjectOutput) time.Time { return aws.ToTime(out.LastModified) }

// --- transfers through the daemon ---

// upload submits an upload job and returns its id. dest is relative to the test's prefix.
func (e *testEnv) upload(profile string, force bool, paths ...string) string {
	e.t.Helper()
	c, cancel := context.WithTimeout(ctx(), rpcTimeout)
	defer cancel()
	resp, err := e.d.Client.UploadPrefixes(c, connect.NewRequest(&s3sharedv1.UploadPrefixRequest{
		TransferProfile: profile,
		BasePath:        e.dir,
		Destination:     e.prefix[:len(e.prefix)-1],
		Prefixes:        paths,
		Force:           force,
	}))
	require.NoError(e.t, err)
	require.True(e.t, resp.Msg.Success, "upload was not queued: %s", resp.Msg.Response)
	return resp.Msg.JobId
}

// download submits a download job for keys relative to the test's prefix into the local scratch dir.
func (e *testEnv) download(profile string, force bool, rels ...string) string {
	e.t.Helper()
	keys := make([]string, len(rels))
	for i, r := range rels {
		keys[i] = e.key(r)
	}
	c, cancel := context.WithTimeout(ctx(), rpcTimeout)
	defer cancel()
	resp, err := e.d.Client.DownloadPrefixes(c, connect.NewRequest(&s3sharedv1.DownloadPrefixesRequest{
		TransferProfile: profile,
		Destination:     e.dir,
		Prefixes:        keys,
		Force:           force,
	}))
	require.NoError(e.t, err)
	require.Equal(e.t, s3sharedv1.S3DownloadPathStatusCode_S3_DOWNLOAD_PATH_STATUS_CODE_QUEUED_DOWNLOAD_SUCCESS, resp.Msg.StatusCode)
	return resp.Msg.JobId
}

// waitJob polls until the job reaches a terminal status and returns it with its tasks.
func (e *testEnv) waitJob(jobID string) (*fmev1.Job, []*fmev1.Task) {
	e.t.Helper()
	deadline := time.Now().Add(jobTimeout)
	for time.Now().Before(deadline) {
		c, cancel := context.WithTimeout(ctx(), rpcTimeout)
		jobs, err := e.d.Client.ListJobs(c, connect.NewRequest(&fmev1.ListJobsRequest{}))
		cancel()
		require.NoError(e.t, err)
		for _, j := range jobs.Msg.Jobs {
			if j.JobId == jobID && terminalStatuses[j.Status] {
				return j, e.tasks(jobID)
			}
		}
		time.Sleep(jobPollEvery)
	}
	e.t.Fatalf("job %s did not finish within %s", jobID, jobTimeout)
	return nil, nil
}

func (e *testEnv) tasks(jobID string) []*fmev1.Task {
	e.t.Helper()
	c, cancel := context.WithTimeout(ctx(), rpcTimeout)
	defer cancel()
	resp, err := e.d.Client.ListTasksForJob(c, connect.NewRequest(&fmev1.ListTasksForJobRequest{JobId: jobID}))
	require.NoError(e.t, err)
	return resp.Msg.Tasks
}

// requireCleanJob asserts that a job finished without any failed task. A failed task does not make
// the job's status an error; the job completes with HasTaskErrors set.
func requireCleanJob(t *testing.T, job *fmev1.Job, tasks []*fmev1.Task) {
	t.Helper()
	require.Equal(t, statusComplete, job.Status, "job status (message: %q)", job.StatusMessage)
	require.False(t, job.HasTaskErrors, "job has failed tasks: %s", describeTasks(tasks))
}

func describeTasks(tasks []*fmev1.Task) string {
	var b bytes.Buffer
	for _, t := range tasks {
		b.WriteString(t.GetS3Object().GetKey() + " [" + t.Status + "] " + t.Err + "\n")
	}
	return b.String()
}
