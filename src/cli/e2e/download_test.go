//go:build e2e

package e2e

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// downloadedPath is where the daemon puts an object: the destination plus the full key.
func (e *testEnv) downloadedPath(rel string) string {
	return filepath.Join(e.dir, filepath.FromSlash(e.key(rel)))
}

func TestDownloadSingleObject(t *testing.T) {
	env := newTestEnv(t)
	data := bytes.Repeat([]byte("file mover express\n"), 5000)
	env.put("hello.txt", data)

	job, tasks := env.waitJob(env.download(profileDefault, false, "hello.txt"))

	requireCleanJob(t, job, tasks)
	got, err := os.ReadFile(env.downloadedPath("hello.txt"))
	require.NoError(t, err)
	assert.Equal(t, data, got)
}

func TestDownloadPrefix(t *testing.T) {
	env := newTestEnv(t)
	env.put("tree/one.txt", []byte("one"))
	env.put("tree/sub/two.txt", []byte("two"))
	env.put("other/skipped.txt", []byte("not requested"))

	job, tasks := env.waitJob(env.download(profileDefault, false, "tree"))

	requireCleanJob(t, job, tasks)
	for rel, want := range map[string]string{"tree/one.txt": "one", "tree/sub/two.txt": "two"} {
		got, err := os.ReadFile(env.downloadedPath(rel))
		require.NoError(t, err, rel)
		assert.Equal(t, want, string(got), rel)
	}
	assert.NoFileExists(t, env.downloadedPath("other/skipped.txt"))
}

func TestUploadThenDownloadRoundTrip(t *testing.T) {
	env := newTestEnv(t)
	// Large enough for a multipart upload and a multipart (ranged) download.
	sum := env.writeFile("round/trip.bin", 22*MiB, 10)
	job, tasks := env.waitJob(env.upload(profileDefault, false, "round"))
	requireCleanJob(t, job, tasks)
	require.NoError(t, os.RemoveAll(filepath.Join(env.dir, "round")))

	job, tasks = env.waitJob(env.download(profileDefault, false, "round"))

	requireCleanJob(t, job, tasks)
	assert.Equal(t, sum, md5File(t, env.downloadedPath("round/trip.bin")))
}
