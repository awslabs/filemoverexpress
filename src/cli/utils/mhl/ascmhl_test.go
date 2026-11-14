package mhl

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/awslabs/filemoverexpress/constants"
)

func ascSamplePath() string {
	return filepath.Join("..", "..", "testdata", "checksums", "ascmhl-sample.mhl")
}

func legacySamplePath() string {
	return filepath.Join("..", "..", "testdata", "checksums", "checksums.mhl")
}

func TestIsASCMHL(t *testing.T) {
	isASC, err := IsASCMHL(ascSamplePath())
	require.NoError(t, err)
	assert.True(t, isASC, "sample manifest declares the urn:ASC:MHL namespace")

	isASC, err = IsASCMHL(legacySamplePath())
	require.NoError(t, err)
	assert.False(t, isASC, "legacy v1.0 hashlist declares no ASC namespace")
}

func TestIsASCMHLMissingFile(t *testing.T) {
	_, err := IsASCMHL(filepath.Join(t.TempDir(), "nope.mhl"))
	assert.Error(t, err)
}

func TestLoadASCMHLFile(t *testing.T) {
	manifest, err := LoadASCMHLFile(ascSamplePath())
	require.NoError(t, err)

	assert.Equal(t, "2.0", manifest.Version)
	// Four <hash> entries; the <directoryhash> is skipped.
	require.Len(t, manifest.Entries, 4)

	byPath := make(map[string]ASCFileEntry)
	for _, e := range manifest.Entries {
		byPath[e.RelativePath] = e
	}

	// xxh64-only entry maps to FME xxhash64, path kept root-relative with subdir.
	mov := byPath["Clips/A002C006_141024_R2EC.mov"]
	assert.Equal(t, int64(5), mov.Size)
	assert.Equal(t, "0ea03b369a463d9d", mov.Hashes[constants.AlgorithmXXHash64])
	assert.Empty(t, mov.UnsupportedAlgos)

	// md5 + c4 entry maps both.
	multi := byPath["Clips/A002C007_141024_R2EC.mov"]
	assert.Equal(t, "d41d8cd98f00b204e9800998ecf8427e", multi.Hashes[constants.AlgorithmMD5])
	assert.Equal(t,
		"c459dsjfscH38cYeXXYogktxf4Cd9ibshE3BHUo6a58hBXmRQdZrAkZzsWcbWtDg5oQstpDuni4Hirj75GEmTc1sFT",
		multi.Hashes[constants.AlgorithmC4],
	)

	// xxh3 supported, xxh128 recorded as unsupported.
	sidecar := byPath["Sidecar.txt"]
	assert.Equal(t, "abc123def4567890", sidecar.Hashes[constants.AlgorithmXXH3])
	assert.Equal(t, []string{"xxh128"}, sidecar.UnsupportedAlgos)

	// sha1-only entry has no honorable hash but is still listed, flagged.
	sha := byPath["OnlySha/notes.txt"]
	assert.Empty(t, sha.Hashes)
	assert.Equal(t, []string{"sha1"}, sha.UnsupportedAlgos)
}

func TestLoadASCMHLFileInvalidXML(t *testing.T) {
	path := filepath.Join(t.TempDir(), "bad.mhl")
	require.NoError(t, os.WriteFile(path, []byte("<hashlist version=\"2.0\"><hashes>"), 0o600))

	_, err := LoadASCMHLFile(path)
	assert.Error(t, err)
}

func TestIsAcceptableAction(t *testing.T) {
	for _, a := range []string{"", "original", "verified", "new", "VERIFIED", " original "} {
		assert.True(t, isAcceptableAction(a), "action %q should be acceptable", a)
	}
	for _, a := range []string{"failed", "FAILED", "bogus"} {
		assert.False(t, isAcceptableAction(a), "action %q should be rejected", a)
	}
}

// A hash recorded with action="failed" must not be trusted as an expected value,
// so the file falls through to the unsupported list (nothing honorable remains).
func TestLoadASCMHLFileSkipsFailedAction(t *testing.T) {
	xml := `<?xml version="1.0" encoding="UTF-8"?>
<hashlist version="2.0" xmlns="urn:ASC:MHL:v2.0">
  <hashes>
    <hash>
      <path size="5">Clips/good.mov</path>
      <xxh64 action="original">0ea03b369a463d9d</xxh64>
    </hash>
    <hash>
      <path size="5">Clips/bad.mov</path>
      <xxh64 action="failed">0ea03b369a463d9d</xxh64>
    </hash>
  </hashes>
</hashlist>`
	path := filepath.Join(t.TempDir(), "actions.mhl")
	require.NoError(t, os.WriteFile(path, []byte(xml), 0o600))

	manifest, err := LoadASCMHLFile(path)
	require.NoError(t, err)

	byPath := make(map[string]ASCFileEntry)
	for _, e := range manifest.Entries {
		byPath[e.RelativePath] = e
	}
	assert.Equal(t, "0ea03b369a463d9d", byPath["Clips/good.mov"].Hashes[constants.AlgorithmXXHash64])
	// The failed hash is not honored - no trusted hash remains for that file.
	assert.Empty(t, byPath["Clips/bad.mov"].Hashes)
}
