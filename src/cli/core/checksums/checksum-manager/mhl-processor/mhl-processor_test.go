package mhl_processor

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/core/checksums"
	"github.com/awslabs/filemoverexpress/utils/mhl"
)

// fmeChecksum computes a file's checksum with FME's own checksummer, so manifest
// values in tests are exactly what FME will later compute.
func fmeChecksum(t *testing.T, path string, algo constants.ChecksumAlgorithm) string {
	t.Helper()
	c, err := checksums.NewChecksummer(algo)
	require.NoError(t, err)
	v, err := c.ChecksumFile(path)
	require.NoError(t, err)
	return v
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o750))
	require.NoError(t, os.WriteFile(path, []byte(content), 0o600))
}

func TestNormalizeHexAndEqual(t *testing.T) {
	assert.Equal(t, "ea03b369a463d9d", normalizeHex("0ea03b369a463d9d"))
	assert.Equal(t, "ea03b369a463d9d", normalizeHex("EA03B369A463D9D"))
	assert.Equal(t, "0", normalizeHex("0000"))

	// ASC MHL zero-pads hex; FME emits the minimal-width integer. They match.
	assert.True(t, checksumsEqual(constants.AlgorithmXXHash64, "ea03b369a463d9d", "0ea03b369a463d9d"))
	assert.False(t, checksumsEqual(constants.AlgorithmXXHash64, "ea03b369a463d9d", "deadbeef"))

	// C4 IDs are base58 and compared verbatim (no hex normalization).
	c4 := "c459dsjfscH38cYeXXYogktxf4Cd9ibshE3BHUo6a58hBXmRQdZrAkZzsWcbWtDg5oQstpDuni4Hirj75GEmTc1sFT"
	assert.True(t, checksumsEqual(constants.AlgorithmC4, c4, c4))
	assert.False(t, checksumsEqual(constants.AlgorithmC4, c4, "c4different"))
}

func TestLatestASCGenerations(t *testing.T) {
	paths := []string{
		"/vol/A002/ascmhl/0001_A002_2020-01-16.mhl",
		"/vol/A002/ascmhl/0002_A002_2020-01-17.mhl",
		"/vol/A003/ascmhl/0001_A003_2020-01-16.mhl",
	}
	got := latestASCGenerations(paths)
	assert.ElementsMatch(t, []string{
		"/vol/A002/ascmhl/0002_A002_2020-01-17.mhl",
		"/vol/A003/ascmhl/0001_A003_2020-01-16.mhl",
	}, got)
}

func TestLegacyMHLStillImportsAndASCSkipped(t *testing.T) {
	// Legacy v1 manifest is still imported; ASC v2 manifest is skipped by
	// ProcessMHLFiles (it is verified by VerifyASCMHL, never imported).
	legacy := filepath.Join("..", "..", "..", "..", "testdata", "checksums", "checksums.mhl")
	asc := filepath.Join("..", "..", "..", "..", "testdata", "checksums", "ascmhl-sample.mhl")

	ascIsASC, err := mhl.IsASCMHL(asc)
	require.NoError(t, err)
	assert.True(t, ascIsASC)
	legacyIsASC, err := mhl.IsASCMHL(legacy)
	require.NoError(t, err)
	assert.False(t, legacyIsASC)
}

func TestVerifyManifestOutcomes(t *testing.T) {
	root := t.TempDir()
	manifestPath := filepath.Join(root, "ascmhl", "0001_root_2026-01-01.mhl")

	// verified: xxh64 present (not the profile algo), value correct.
	writeFile(t, filepath.Join(root, "Clips", "good.mov"), "good-clip-bytes")
	goodXX := fmeChecksum(t, filepath.Join(root, "Clips", "good.mov"), constants.AlgorithmXXHash64)

	// mismatched: xxh64 present but wrong.
	writeFile(t, filepath.Join(root, "Clips", "bad.mov"), "bad-clip-bytes")

	// imported: md5 present and md5 is the profile algo.
	writeFile(t, filepath.Join(root, "imported.txt"), "imported-bytes")
	importedMD5 := fmeChecksum(t, filepath.Join(root, "imported.txt"), constants.AlgorithmMD5)

	// unhonored: only sha1, which FME cannot compute.
	writeFile(t, filepath.Join(root, "sha-only.txt"), "sha-bytes")

	manifest := mhl.ASCManifest{
		Version: "2.0",
		Entries: []mhl.ASCFileEntry{
			{RelativePath: "Clips/good.mov", Hashes: map[constants.ChecksumAlgorithm]string{constants.AlgorithmXXHash64: goodXX}},
			{RelativePath: "Clips/bad.mov", Hashes: map[constants.ChecksumAlgorithm]string{constants.AlgorithmXXHash64: "deadbeefdeadbeef"}},
			{RelativePath: "imported.txt", Hashes: map[constants.ChecksumAlgorithm]string{constants.AlgorithmMD5: importedMD5}},
			{RelativePath: "missing.mov", Hashes: map[constants.ChecksumAlgorithm]string{constants.AlgorithmXXHash64: goodXX}},
			{RelativePath: "sha-only.txt", Hashes: map[constants.ChecksumAlgorithm]string{}, UnsupportedAlgos: []string{"sha1"}},
		},
	}

	counts := verifyManifest(verifyCtx{jobID: "job-1", jobName: "test-job", profileAlgorithm: constants.AlgorithmMD5}, manifestPath, manifest)
	// good.mov verifies via its xxh64; imported.txt verifies via md5 (the profile
	// algo). Both are re-hashed and compared - nothing is trusted unverified.
	assert.Equal(t, 2, counts.verified, "good.mov (xxh64) and imported.txt (md5) both verify")
	assert.Equal(t, 1, counts.mismatched, "bad.mov does not match")
	assert.Equal(t, 1, counts.missing, "missing.mov is absent on disk")
	assert.Equal(t, 1, counts.unhonored, "sha-only.txt has no FME-supported hash")
}

func TestVerifyManifestHonorsC4(t *testing.T) {
	root := t.TempDir()
	manifestPath := filepath.Join(root, "ascmhl", "0001_root.mhl")

	writeFile(t, filepath.Join(root, "asset.mov"), "c4-asset-bytes")
	c4 := fmeChecksum(t, filepath.Join(root, "asset.mov"), constants.AlgorithmC4)

	manifest := mhl.ASCManifest{
		Entries: []mhl.ASCFileEntry{
			{RelativePath: "asset.mov", Hashes: map[constants.ChecksumAlgorithm]string{constants.AlgorithmC4: c4}},
		},
	}

	// Profile algo is xxhash64, so the only honorable hash is the C4 one.
	counts := verifyManifest(verifyCtx{jobID: "job-1", jobName: "test-job", profileAlgorithm: constants.AlgorithmXXHash64}, manifestPath, manifest)
	assert.Equal(t, 1, counts.verified)
	assert.Equal(t, 0, counts.mismatched)
}

// integrityProblems counts only mismatches + missing (not unhonored), because
// those are the outcomes that drive COMPLETED_WITH_WARNINGS.
func TestIntegrityProblems(t *testing.T) {
	assert.Equal(t, 0, verifyCounts{verified: 5}.integrityProblems())
	assert.Equal(t, 0, verifyCounts{verified: 3, unhonored: 2}.integrityProblems())
	assert.Equal(t, 3, verifyCounts{mismatched: 1, missing: 2}.integrityProblems())
}

// Guard the algorithm choice: profile algo wins when present, else fastest.
func TestPickVerifyAlgorithm(t *testing.T) {
	entry := mhl.ASCFileEntry{Hashes: map[constants.ChecksumAlgorithm]string{
		constants.AlgorithmMD5:      "m",
		constants.AlgorithmXXHash64: "x",
	}}

	// Profile algo present -> preferred.
	algo, value, ok := pickVerifyAlgorithm(entry, constants.AlgorithmMD5)
	require.True(t, ok)
	assert.Equal(t, constants.AlgorithmMD5, algo)
	assert.Equal(t, "m", value)

	// Profile algo absent -> fastest available from the priority list.
	algo, value, ok = pickVerifyAlgorithm(entry, constants.AlgorithmNone)
	require.True(t, ok)
	assert.Equal(t, constants.AlgorithmXXHash64, algo)
	assert.Equal(t, "x", value)

	_, _, ok = pickVerifyAlgorithm(mhl.ASCFileEntry{Hashes: map[constants.ChecksumAlgorithm]string{}}, constants.AlgorithmXXHash64)
	assert.False(t, ok)
}

// Sanity check that a round-tripped xxh64 with ASC-style zero padding verifies.
func TestVerifyManifestHexPadding(t *testing.T) {
	root := t.TempDir()
	manifestPath := filepath.Join(root, "ascmhl", "0001_root.mhl")
	writeFile(t, filepath.Join(root, "f.mov"), "padding-bytes")
	xx := fmeChecksum(t, filepath.Join(root, "f.mov"), constants.AlgorithmXXHash64)

	// ASC MHL writes xxh64 zero-padded to 16 hex chars; FME emits the minimal
	// width. Pad to prove normalization makes them compare equal.
	padded := xx
	for len(padded) < 16 {
		padded = "0" + padded
	}

	manifest := mhl.ASCManifest{Entries: []mhl.ASCFileEntry{
		{RelativePath: "f.mov", Hashes: map[constants.ChecksumAlgorithm]string{constants.AlgorithmXXHash64: padded}},
	}}
	counts := verifyManifest(verifyCtx{jobID: "job-1", jobName: "test-job", profileAlgorithm: constants.AlgorithmMD5}, manifestPath, manifest)
	assert.Equal(t, 1, counts.verified)
}
