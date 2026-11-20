//go:build e2e

package e2e

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

const suiteBucket = "e2e"

// suite is the state shared by every test: one emulator, one daemon, and a bucket.
type suite struct {
	em     *emulator
	d      *daemon
	s3     *s3.Client
	bucket string
	work   string
}

// shared is set by TestMain before any test runs.
var shared *suite

func TestMain(m *testing.M) {
	os.Exit(runSuite(m))
}

func runSuite(m *testing.M) int {
	s, err := newSuite()
	if err != nil {
		fmt.Fprintf(os.Stderr, "e2e: setup failed: %v\n", err)
		return 1
	}
	shared = s

	code := m.Run()

	if err := s.close(); err != nil {
		fmt.Fprintf(os.Stderr, "e2e: teardown: %v\n", err)
		if code == 0 {
			code = 1
		}
	}
	return code
}

func newSuite() (*suite, error) {
	work, err := os.MkdirTemp("", "e2e-suite-")
	if err != nil {
		return nil, err
	}
	s := &suite{work: work, bucket: suiteBucket}

	if s.em, err = startEmulator(); err != nil {
		return s, errCleanup(s, err)
	}
	if s.s3, err = newS3Client(s.em); err != nil {
		return s, errCleanup(s, err)
	}
	if _, err = s.s3.CreateBucket(context.Background(), &s3.CreateBucketInput{Bucket: aws.String(s.bucket)}); err != nil {
		return s, errCleanup(s, fmt.Errorf("create bucket: %w", err))
	}
	bin, err := buildDaemon(work)
	if err != nil {
		return s, errCleanup(s, err)
	}
	cfg := daemonConfig{Bucket: s.bucket, Endpoint: s.em.Endpoint, Region: s.em.region()}
	if s.d, err = startDaemon(bin, work, s.em, cfg); err != nil {
		return s, errCleanup(s, err)
	}
	return s, nil
}

// errCleanup releases what was started so far and returns the original error.
func errCleanup(s *suite, err error) error {
	_ = s.close()
	return err
}

func (s *suite) close() error {
	var err error
	if s.d != nil {
		err = s.d.stop()
	}
	if s.em != nil {
		s.em.stop()
	}
	if s.work != "" && os.Getenv("E2E_KEEP_WORKDIR") == "" {
		_ = os.RemoveAll(s.work)
	}
	return err
}

// newS3Client builds the suite's own S3 client for seeding and checking objects. It does not use
// the daemon's code, so the daemon's behavior is verified independently.
func newS3Client(em *emulator) (*s3.Client, error) {
	cfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithSharedConfigFiles([]string{em.ConfigFile}),
		config.WithSharedCredentialsFiles([]string{em.CredentialsFile}),
		config.WithSharedConfigProfile("default"),
	)
	if err != nil {
		return nil, fmt.Errorf("load emulator client config: %w", err)
	}
	return s3.NewFromConfig(cfg, func(o *s3.Options) { o.UsePathStyle = true }), nil
}

// region reads the region the emulator advertises in its generated config.
func (e *emulator) region() string {
	b, err := os.ReadFile(e.ConfigFile)
	if err != nil {
		return "us-east-1"
	}
	for _, line := range strings.Split(string(b), "\n") {
		if k, v, ok := strings.Cut(line, "="); ok && strings.TrimSpace(k) == "region" {
			return strings.TrimSpace(v)
		}
	}
	return "us-east-1"
}
