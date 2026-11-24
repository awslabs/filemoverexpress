//go:build e2e

package e2e

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUploadSingleFile(t *testing.T) {
	env := newTestEnv(t)
	sum := env.writeFile("small.bin", 1*MiB, 1)

	job, tasks := env.waitJob(env.upload(profileDefault, false, "small.bin"))

	requireCleanJob(t, job, tasks)
	obj := env.head("small.bin")
	assert.EqualValues(t, 1*MiB, *obj.ContentLength)
	assert.Equal(t, sum, obj.Metadata[metaMD5], "the daemon stores the file's MD5 as object metadata")
	assert.Equal(t, sum, env.objectMD5("small.bin"), "uploaded content")
}

func TestUploadDirectoryTree(t *testing.T) {
	env := newTestEnv(t)
	sums := map[string]string{
		"tree/a.txt":          env.writeFile("tree/a.txt", 10, 2),
		"tree/sub/b.bin":      env.writeFile("tree/sub/b.bin", 300_000, 3),
		"tree/sub/deep/c.bin": env.writeFile("tree/sub/deep/c.bin", 64*1024, 4),
	}

	job, tasks := env.waitJob(env.upload(profileDefault, false, "tree"))

	requireCleanJob(t, job, tasks)
	assert.ElementsMatch(t, []string{"tree/a.txt", "tree/sub/b.bin", "tree/sub/deep/c.bin"}, env.keys())
	for rel, sum := range sums {
		assert.Equal(t, sum, env.objectMD5(rel), rel)
	}
}

func TestUploadMultipartFile(t *testing.T) {
	env := newTestEnv(t)
	// The daemon plans part size from the file size (adaptive concurrency is on by default), so use a
	// file large enough that the plan always has more than one part.
	sum := env.writeFile("big.bin", 22*MiB, 5)

	job, tasks := env.waitJob(env.upload(profileDefault, false, "big.bin"))

	requireCleanJob(t, job, tasks)
	obj := env.head("big.bin")
	assert.Regexp(t, "-([2-9]|[1-9][0-9]+)$", strings.Trim(*obj.ETag, `"`), "a multipart ETag ends in the part count")
	assert.Equal(t, sum, obj.Metadata[metaMD5])
	assert.Equal(t, sum, env.objectMD5("big.bin"), "reassembled content")
}

func TestUploadSkipsExistingObjectUnlessForced(t *testing.T) {
	env := newTestEnv(t)
	env.writeFile("same.bin", 1*MiB, 6)
	job, tasks := env.waitJob(env.upload(profileDefault, false, "same.bin"))
	requireCleanJob(t, job, tasks)
	first := lastModified(env.head("same.bin"))

	// LastModified has one second resolution.
	time.Sleep(1100 * time.Millisecond)
	job, tasks = env.waitJob(env.upload(profileDefault, false, "same.bin"))
	requireCleanJob(t, job, tasks)
	assert.Equal(t, first, lastModified(env.head("same.bin")), "an unchanged file must not be uploaded again")

	job, tasks = env.waitJob(env.upload(profileDefault, true, "same.bin"))
	requireCleanJob(t, job, tasks)
	assert.True(t, lastModified(env.head("same.bin")).After(first), "force uploads the file again")
}

func TestUploadWithChecksumsDisabled(t *testing.T) {
	env := newTestEnv(t)
	env.writeFile("plain.bin", 256*1024, 7)

	job, tasks := env.waitJob(env.upload(profileNoChecksum, false, "plain.bin"))

	requireCleanJob(t, job, tasks)
	obj := env.head("plain.bin")
	assert.NotContains(t, obj.Metadata, metaMD5)
	assert.NotContains(t, obj.Metadata, metaXXH3)
}

func TestUploadStoresXXH3Checksum(t *testing.T) {
	env := newTestEnv(t)
	env.writeFile("x.bin", 256*1024, 8)

	job, tasks := env.waitJob(env.upload(profileXXH3, false, "x.bin"))

	requireCleanJob(t, job, tasks)
	obj := env.head("x.bin")
	assert.NotEmpty(t, obj.Metadata[metaXXH3])
	assert.NotContains(t, obj.Metadata, metaMD5)
}

func TestUploadToMissingBucketFailsTheTask(t *testing.T) {
	env := newTestEnv(t)
	env.writeFile("f.bin", 1024, 9)

	job, tasks := env.waitJob(env.upload(profileMissingBucket, false, "f.bin"))

	// The job itself completes; the failure is reported on the task.
	require.True(t, job.HasTaskErrors, "tasks: %s", describeTasks(tasks))
	require.NotEmpty(t, tasks)
	assert.Equal(t, "ERROR", tasks[0].Status)
	assert.Contains(t, tasks[0].Err, "NoSuchBucket")
	assert.False(t, job.HasSuccessfulTasks)
}
