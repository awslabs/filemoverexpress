//go:build e2e

package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/stretchr/testify/require"
)

// envServe turns TestServeEnvironment on. Without it the test is skipped, so a normal run of the
// suite never blocks.
const envServe = "E2E_SERVE"

// readyMarker prefixes the line TestServeEnvironment prints once everything is up. The GUI layer
// waits for it on the process's standard output.
const readyMarker = "E2E_READY "

// serveInfo is the JSON that follows the ready marker.
type serveInfo struct {
	WorkDir  string `json:"workDir"`
	Home     string `json:"home"`     // HOME of the daemon; the desktop app must use the same one
	FilesDir string `json:"filesDir"` // local folder with files to upload
	Bucket   string `json:"bucket"`
	Endpoint string `json:"endpoint"`
	Profile  string `json:"profile"`
}

// seededObjects are placed in the bucket before the GUI starts, keyed under seed/.
var seededObjects = map[string]string{
	"seed/readme.txt":       "hello from the emulator\n",
	"seed/nested/data.txt":  "nested object\n",
	"seed/nested/other.txt": "another nested object\n",
}

// localFiles are created in the local folder the GUI uploads from.
var localFiles = map[string]string{
	"upload-me.txt":     "this file is uploaded by the GUI test\n",
	"folder/inside.txt": "a file inside a folder\n",
}

// TestServeEnvironment is not a test. It keeps the emulator, the daemon and a seeded bucket
// running until it receives SIGINT or SIGTERM, so the browser tests in src/gui/e2e have a real
// backend. Playwright starts it as the compiled test binary:
//
//	e2e.test -test.run '^TestServeEnvironment$' -test.v -test.timeout 0
func TestServeEnvironment(t *testing.T) {
	if os.Getenv(envServe) == "" {
		t.Skipf("set %s=1 to run the environment for the GUI tests", envServe)
	}
	s := shared
	info := serveInfo{
		WorkDir:  s.work,
		Home:     filepath.Join(s.work, homeDirName),
		FilesDir: filepath.Join(s.work, "files"),
		Bucket:   s.bucket,
		Endpoint: s.em.Endpoint,
		Profile:  profileDefault,
	}
	seedBucket(t, s)
	seedLocalFiles(t, info.FilesDir)

	line, err := json.Marshal(info)
	require.NoError(t, err)
	fmt.Fprintf(os.Stdout, "%s%s\n", readyMarker, line)

	stop, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	<-stop.Done()
}

func seedBucket(t *testing.T, s *suite) {
	t.Helper()
	for key, body := range seededObjects {
		_, err := s.s3.PutObject(ctx(), &s3.PutObjectInput{
			Bucket: aws.String(s.bucket), Key: aws.String(key), Body: strings.NewReader(body),
		})
		require.NoError(t, err, key)
	}
}

func seedLocalFiles(t *testing.T, dir string) {
	t.Helper()
	for rel, body := range localFiles {
		path := filepath.Join(dir, filepath.FromSlash(rel))
		require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o750))
		require.NoError(t, os.WriteFile(path, []byte(body), 0o600))
	}
}
