package mhl_processor

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/core/checksums"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
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

	counts := verifyManifest(verifyCtx{ctx: context.Background(), jobID: "job-1", jobName: "test-job", profileAlgorithm: constants.AlgorithmMD5}, manifestPath, manifest, nil)
	// good.mov verifies via its xxh64; imported.txt verifies via md5 (the profile
	// algo). Both are re-hashed and compared - nothing is trusted unverified.
	assert.Equal(t, 2, counts.verified, "good.mov (xxh64) and imported.txt (md5) both verify")
	assert.Equal(t, 1, counts.mismatched, "bad.mov does not match")
	assert.Equal(t, 1, counts.missing, "missing.mov is absent on disk")
	assert.Equal(t, 1, counts.unhonored, "sha-only.txt has no FME-supported hash")
}

// On a successful verify, the verified hash is carried onto the task (so the
// upload tags the object) only when the task has no checksum of its own, and
// never overwrites a profile-computed one.
func TestVerifyManifestTagsTaskFromVerifiedHash(t *testing.T) {
	root := t.TempDir()
	manifestPath := filepath.Join(root, "ascmhl", "0001_root.mhl")
	writeFile(t, filepath.Join(root, "a.mov"), "tag-me-bytes")
	xx := fmeChecksum(t, filepath.Join(root, "a.mov"), constants.AlgorithmXXHash64)
	abs, err := filepath.Abs(filepath.Join(root, "a.mov"))
	require.NoError(t, err)

	newTask := func() *jobmanagertypes.Task {
		task, terr := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
			LocalFile:     jobmanagertypes.LocalFile{Path: abs},
			TaskDirection: jobmanagertypes.TaskDirectionUpload,
			JobId:         "job-1",
		})
		require.NoError(t, terr)
		return task
	}

	manifest := mhl.ASCManifest{Entries: []mhl.ASCFileEntry{
		{RelativePath: "a.mov", Hashes: map[constants.ChecksumAlgorithm]string{constants.AlgorithmXXHash64: xx}},
	}}

	// Task with no checksum (in-app checksum off): it gets tagged.
	empty := newTask()
	vctx := verifyCtx{
		ctx:              context.Background(),
		profileAlgorithm: constants.AlgorithmNone,
		taskByPath:       map[string]*jobmanagertypes.Task{abs: empty},
	}
	counts := verifyManifest(vctx, manifestPath, manifest, nil)
	assert.Equal(t, 1, counts.verified)
	assert.Equal(t, xx, empty.Checksum())
	assert.Equal(t, string(constants.AlgorithmXXHash64), empty.ChecksumAlgorithm())

	// Task that already has a (profile-computed) checksum is left untouched.
	preset := newTask()
	preset.SetChecksum("preset-value")
	vctx2 := verifyCtx{
		ctx:              context.Background(),
		profileAlgorithm: constants.AlgorithmXXHash64,
		precomputed:      map[string]string{abs: xx},
		taskByPath:       map[string]*jobmanagertypes.Task{abs: preset},
	}
	verifyManifest(vctx2, manifestPath, manifest, nil)
	assert.Equal(t, "preset-value", preset.Checksum())
	assert.Equal(t, "", preset.ChecksumAlgorithm())
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
	counts := verifyManifest(verifyCtx{ctx: context.Background(), jobID: "job-1", jobName: "test-job", profileAlgorithm: constants.AlgorithmXXHash64}, manifestPath, manifest, nil)
	assert.Equal(t, 1, counts.verified)
	assert.Equal(t, 0, counts.mismatched)
}

// integrityProblems counts only mismatches + missing (not unhonored), because
// those are the outcomes that drive COMPLETED_WITH_WARNINGS.
func TestIntegrityProblems(t *testing.T) {
	assert.Equal(t, 0, verifyCounts{verified: 5}.integrityProblems())
	assert.Equal(t, 0, verifyCounts{verified: 3, unhonored: 2}.integrityProblems())
	assert.Equal(t, 0, verifyCounts{verified: 3, notListed: 2}.integrityProblems())
	assert.Equal(t, 4, verifyCounts{mismatched: 1, missing: 1, unreadable: 1, rejected: 1}.integrityProblems())
}

// A manifest entry whose path escapes the offload tree must never be statted or
// hashed, and must count as an integrity problem.
func TestVerifyManifestRejectsPathTraversal(t *testing.T) {
	root := t.TempDir()
	manifestPath := filepath.Join(root, "ascmhl", "0001_root.mhl")
	// A real secret file outside the offload tree the manifest tries to reach.
	outside := filepath.Join(t.TempDir(), "secret.txt")
	writeFile(t, outside, "secret-bytes")

	manifest := mhl.ASCManifest{Entries: []mhl.ASCFileEntry{
		{RelativePath: "../../" + filepath.Base(filepath.Dir(outside)) + "/secret.txt",
			Hashes: map[constants.ChecksumAlgorithm]string{constants.AlgorithmXXHash64: "deadbeef"}},
	}}

	counts := verifyManifest(verifyCtx{ctx: context.Background(), jobID: "j", jobName: "n", profileAlgorithm: constants.AlgorithmMD5}, manifestPath, manifest, nil)
	assert.Equal(t, 1, counts.rejected)
	assert.Equal(t, 0, counts.verified)
	assert.Equal(t, 1, counts.integrityProblems())
}

// An unreadable listed file is an integrity problem, not a benign skip.
func TestVerifyManifestUnreadableIsIntegrityProblem(t *testing.T) {
	root := t.TempDir()
	manifestPath := filepath.Join(root, "ascmhl", "0001_root.mhl")
	// A directory where the manifest expects a file: Stat succeeds, hashing fails.
	require.NoError(t, os.MkdirAll(filepath.Join(root, "notafile"), 0o750))

	manifest := mhl.ASCManifest{Entries: []mhl.ASCFileEntry{
		{RelativePath: "notafile", Hashes: map[constants.ChecksumAlgorithm]string{constants.AlgorithmXXHash64: "deadbeef"}},
	}}

	counts := verifyManifest(verifyCtx{ctx: context.Background(), jobID: "j", jobName: "n", profileAlgorithm: constants.AlgorithmXXHash64}, manifestPath, manifest, nil)
	assert.Equal(t, 1, counts.unreadable)
	assert.Equal(t, 1, counts.integrityProblems())
}

// computeOrReuse returns the precomputed checksum without re-hashing when the
// algorithm matches the profile, and hashes otherwise.
func TestComputeOrReuse(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "f.mov")
	writeFile(t, path, "reuse-bytes")
	abs, err := filepath.Abs(path)
	require.NoError(t, err)

	vctx := verifyCtx{
		ctx:              context.Background(),
		profileAlgorithm: constants.AlgorithmXXHash64,
		precomputed:      map[string]string{abs: "cafef00d"},
	}
	// Profile algorithm -> reuse the cached value verbatim (no hashing).
	got, err := computeOrReuse(vctx, constants.AlgorithmXXHash64, abs)
	require.NoError(t, err)
	assert.Equal(t, "cafef00d", got)

	// A different algorithm must be computed, not the cached profile value.
	got, err = computeOrReuse(vctx, constants.AlgorithmC4, abs)
	require.NoError(t, err)
	assert.Equal(t, fmeChecksum(t, path, constants.AlgorithmC4), got)
}

func TestIsUnder(t *testing.T) {
	root := "/vol/offload"
	assert.True(t, isUnder(root, "/vol/offload/Clips/a.mov"))
	assert.True(t, isUnder(root, "/vol/offload"))
	assert.False(t, isUnder(root, "/vol/other/a.mov"))
	assert.False(t, isUnder(root, "/vol/offloadX/a.mov"))
}

// Verification recomputes from the bytes when a file is not in the fresh-hash
// map: an empty precomputed map must NOT cause a file to be skipped or trusted.
// This is the integrity guarantee - imported/cached hashes are never in
// precomputed, so they are always re-read here.
func TestVerifyManifestRecomputesWhenNotPrecomputed(t *testing.T) {
	root := t.TempDir()
	manifestPath := filepath.Join(root, "ascmhl", "0001_root.mhl")
	writeFile(t, filepath.Join(root, "a.mov"), "authentic-bytes")
	good := fmeChecksum(t, filepath.Join(root, "a.mov"), constants.AlgorithmXXHash64)

	manifest := mhl.ASCManifest{Entries: []mhl.ASCFileEntry{
		{RelativePath: "a.mov", Hashes: map[constants.ChecksumAlgorithm]string{constants.AlgorithmXXHash64: good}},
	}}

	// precomputed is nil (as it is for imported/cached hashes) -> recompute.
	counts := verifyManifest(verifyCtx{ctx: context.Background(), profileAlgorithm: constants.AlgorithmXXHash64}, manifestPath, manifest, nil)
	assert.Equal(t, 1, counts.verified)
	assert.Equal(t, 0, counts.integrityProblems())
}

// A file whose only manifest hash was marked bad by the writer (action="failed")
// is an integrity problem, not a silent "not-honored".
func TestVerifyManifestWriterFlaggedIsIntegrityProblem(t *testing.T) {
	root := t.TempDir()
	manifestPath := filepath.Join(root, "ascmhl", "0001_root.mhl")
	writeFile(t, filepath.Join(root, "bad.mov"), "bytes")

	manifest := mhl.ASCManifest{Entries: []mhl.ASCFileEntry{
		{RelativePath: "bad.mov", RejectedActions: []string{"xxh64 (action=failed)"}},
	}}

	counts := verifyManifest(verifyCtx{ctx: context.Background(), profileAlgorithm: constants.AlgorithmXXHash64}, manifestPath, manifest, nil)
	assert.Equal(t, 1, counts.flagged)
	assert.Equal(t, 0, counts.unhonored)
	assert.Equal(t, 1, counts.integrityProblems())
}

// The ascmhl/ folder (chain file and manifests) travels with the media; none of
// it may be reported as present-but-not-listed.
func TestVerifyManifestIgnoresAscmhlFolderInUnlisted(t *testing.T) {
	root := t.TempDir()
	manifestPath := filepath.Join(root, "ascmhl", "0001_root.mhl")
	writeFile(t, filepath.Join(root, "a.mov"), "bytes")
	good := fmeChecksum(t, filepath.Join(root, "a.mov"), constants.AlgorithmXXHash64)

	newTask := func(p string) *jobmanagertypes.Task {
		task, err := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
			LocalFile:     jobmanagertypes.LocalFile{Path: p},
			TaskDirection: jobmanagertypes.TaskDirectionUpload,
			JobId:         "job-1",
		})
		require.NoError(t, err)
		return task
	}
	tasks := []*jobmanagertypes.Task{
		newTask(filepath.Join(root, "a.mov")),
		newTask(filepath.Join(root, "ascmhl", "ascmhl_chain.xml")),
		newTask(manifestPath),
	}

	manifest := mhl.ASCManifest{Entries: []mhl.ASCFileEntry{
		{RelativePath: "a.mov", Hashes: map[constants.ChecksumAlgorithm]string{constants.AlgorithmXXHash64: good}},
	}}

	counts := verifyManifest(verifyCtx{ctx: context.Background(), profileAlgorithm: constants.AlgorithmXXHash64}, manifestPath, manifest, tasks)
	assert.Equal(t, 1, counts.verified)
	assert.Equal(t, 0, counts.notListed, "chain file and manifest under ascmhl/ must not be flagged unlisted")
}

// A media file present on disk but absent from the manifest IS reported.
func TestVerifyManifestReportsGenuinelyUnlisted(t *testing.T) {
	root := t.TempDir()
	manifestPath := filepath.Join(root, "ascmhl", "0001_root.mhl")
	writeFile(t, filepath.Join(root, "a.mov"), "bytes")
	good := fmeChecksum(t, filepath.Join(root, "a.mov"), constants.AlgorithmXXHash64)
	writeFile(t, filepath.Join(root, "stowaway.mov"), "extra")

	newTask := func(p string) *jobmanagertypes.Task {
		task, err := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
			LocalFile:     jobmanagertypes.LocalFile{Path: p},
			TaskDirection: jobmanagertypes.TaskDirectionUpload,
			JobId:         "job-1",
		})
		require.NoError(t, err)
		return task
	}
	tasks := []*jobmanagertypes.Task{
		newTask(filepath.Join(root, "a.mov")),
		newTask(filepath.Join(root, "stowaway.mov")),
	}

	manifest := mhl.ASCManifest{Entries: []mhl.ASCFileEntry{
		{RelativePath: "a.mov", Hashes: map[constants.ChecksumAlgorithm]string{constants.AlgorithmXXHash64: good}},
	}}

	counts := verifyManifest(verifyCtx{ctx: context.Background(), profileAlgorithm: constants.AlgorithmXXHash64}, manifestPath, manifest, tasks)
	assert.Equal(t, 1, counts.notListed)
	assert.Equal(t, 0, counts.integrityProblems(), "a stowaway file is a warning, not an integrity failure")
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
	counts := verifyManifest(verifyCtx{ctx: context.Background(), jobID: "job-1", jobName: "test-job", profileAlgorithm: constants.AlgorithmMD5}, manifestPath, manifest, nil)
	assert.Equal(t, 1, counts.verified)
}

// A successful verify records which algorithm honored the manifest, so the job
// summary can report it (e.g. the chip and Advanced-details row in the GUI).
func TestVerifyManifestCapturesAlgorithm(t *testing.T) {
	root := t.TempDir()
	manifestPath := filepath.Join(root, "ascmhl", "0001_root.mhl")
	writeFile(t, filepath.Join(root, "a.mov"), "algo-capture-bytes")
	xx := fmeChecksum(t, filepath.Join(root, "a.mov"), constants.AlgorithmXXHash64)

	manifest := mhl.ASCManifest{Entries: []mhl.ASCFileEntry{
		{RelativePath: "a.mov", Hashes: map[constants.ChecksumAlgorithm]string{constants.AlgorithmXXHash64: xx}},
	}}

	counts := verifyManifest(
		verifyCtx{ctx: context.Background(), jobID: "job-1", jobName: "test-job", profileAlgorithm: constants.AlgorithmNone},
		manifestPath, manifest, nil,
	)
	assert.Equal(t, 1, counts.verified)
	assert.Equal(t, string(constants.AlgorithmXXHash64), counts.algorithm)
}

// VerifyASCMHL discovers the manifest among the tasks, verifies every listed
// file, and returns the aggregate result (verified / listed counts, algorithm,
// and integrity problems) the job surfaces to the GUI.
func TestVerifyASCMHLAggregatesResult(t *testing.T) {
	root := t.TempDir()
	manifestPath := filepath.Join(root, "ascmhl", "0001_root.mhl")
	writeFile(t, filepath.Join(root, "clip.mov"), "aggregate-bytes")
	xx := fmeChecksum(t, filepath.Join(root, "clip.mov"), constants.AlgorithmXXHash64)

	writeFile(t, manifestPath, `<?xml version="1.0" encoding="UTF-8"?>
<hashlist version="2.0" xmlns="urn:ASC:MHL:v2.0">
  <hashes>
    <hash>
      <path size="15">clip.mov</path>
      <xxh64 action="original">`+xx+`</xxh64>
    </hash>
  </hashes>
</hashlist>`)

	mkTask := func(p string) *jobmanagertypes.Task {
		abs, err := filepath.Abs(p)
		require.NoError(t, err)
		task, terr := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
			LocalFile:     jobmanagertypes.LocalFile{Path: abs},
			TaskDirection: jobmanagertypes.TaskDirectionUpload,
			JobId:         "job-agg",
		})
		require.NoError(t, terr)
		return task
	}
	tasks := []*jobmanagertypes.Task{mkTask(manifestPath), mkTask(filepath.Join(root, "clip.mov"))}

	result := VerifyASCMHL(VerifyRequest{
		Ctx:              context.Background(),
		JobID:            "job-agg",
		JobName:          "agg",
		Tasks:            tasks,
		ProfileAlgorithm: constants.AlgorithmNone,
	})
	assert.Equal(t, 1, result.Verified, "clip.mov verifies against its xxh64 hash")
	assert.Equal(t, 1, result.Listed, "manifest lists one file")
	assert.Equal(t, 0, result.Problems, "a clean offload has no integrity problems")
	assert.Equal(t, string(constants.AlgorithmXXHash64), result.Algorithm)
}

// A manifest with a mismatching hash still reports the listed count and the
// algorithm, but surfaces the integrity problem.
func TestVerifyASCMHLReportsProblems(t *testing.T) {
	root := t.TempDir()
	manifestPath := filepath.Join(root, "ascmhl", "0001_root.mhl")
	writeFile(t, filepath.Join(root, "clip.mov"), "tampered-bytes")

	writeFile(t, manifestPath, `<?xml version="1.0" encoding="UTF-8"?>
<hashlist version="2.0" xmlns="urn:ASC:MHL:v2.0">
  <hashes>
    <hash>
      <path size="14">clip.mov</path>
      <xxh64 action="original">deadbeefdeadbeef</xxh64>
    </hash>
  </hashes>
</hashlist>`)

	abs, err := filepath.Abs(manifestPath)
	require.NoError(t, err)
	clipAbs, err := filepath.Abs(filepath.Join(root, "clip.mov"))
	require.NoError(t, err)
	mkTask := func(p string) *jobmanagertypes.Task {
		task, terr := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
			LocalFile:     jobmanagertypes.LocalFile{Path: p},
			TaskDirection: jobmanagertypes.TaskDirectionUpload,
			JobId:         "job-bad",
		})
		require.NoError(t, terr)
		return task
	}

	result := VerifyASCMHL(VerifyRequest{
		Ctx:              context.Background(),
		JobID:            "job-bad",
		JobName:          "bad",
		Tasks:            []*jobmanagertypes.Task{mkTask(abs), mkTask(clipAbs)},
		ProfileAlgorithm: constants.AlgorithmNone,
	})
	assert.Equal(t, 0, result.Verified)
	assert.Equal(t, 1, result.Listed)
	assert.Equal(t, 1, result.Problems, "a hash mismatch is an integrity problem")
}

// Even when every file mismatches, the algorithm that was used is still recorded
// so the job summary can report it (regression guard for the empty-algorithm case).
func TestVerifyManifestCapturesAlgorithmOnMismatch(t *testing.T) {
	root := t.TempDir()
	manifestPath := filepath.Join(root, "ascmhl", "0001_root.mhl")
	writeFile(t, filepath.Join(root, "a.mov"), "mismatch-bytes")

	manifest := mhl.ASCManifest{Entries: []mhl.ASCFileEntry{
		{RelativePath: "a.mov", Hashes: map[constants.ChecksumAlgorithm]string{constants.AlgorithmXXHash64: "deadbeefdeadbeef"}},
	}}

	counts := verifyManifest(
		verifyCtx{ctx: context.Background(), jobID: "j", jobName: "n", profileAlgorithm: constants.AlgorithmNone},
		manifestPath, manifest, nil,
	)
	assert.Equal(t, 1, counts.mismatched)
	assert.Equal(t, 0, counts.verified)
	assert.Equal(t, string(constants.AlgorithmXXHash64), counts.algorithm, "algorithm is recorded even on an all-mismatch run")
}

// Two manifests honored with different algorithms aggregate to a "mixed" label,
// since no single algorithm describes the whole job.
func TestVerifyASCMHLMixedAlgorithms(t *testing.T) {
	root := t.TempDir()

	// sub1: xxh64
	writeFile(t, filepath.Join(root, "sub1", "clip.mov"), "sub1-bytes")
	xx := fmeChecksum(t, filepath.Join(root, "sub1", "clip.mov"), constants.AlgorithmXXHash64)
	m1 := filepath.Join(root, "sub1", "ascmhl", "0001_sub1.mhl")
	writeFile(t, m1, `<?xml version="1.0" encoding="UTF-8"?>
<hashlist version="2.0" xmlns="urn:ASC:MHL:v2.0">
  <hashes><hash><path size="10">clip.mov</path><xxh64 action="original">`+xx+`</xxh64></hash></hashes>
</hashlist>`)

	// sub2: md5
	writeFile(t, filepath.Join(root, "sub2", "clip.mov"), "sub2-bytes")
	md5 := fmeChecksum(t, filepath.Join(root, "sub2", "clip.mov"), constants.AlgorithmMD5)
	m2 := filepath.Join(root, "sub2", "ascmhl", "0001_sub2.mhl")
	writeFile(t, m2, `<?xml version="1.0" encoding="UTF-8"?>
<hashlist version="2.0" xmlns="urn:ASC:MHL:v2.0">
  <hashes><hash><path size="10">clip.mov</path><md5 action="original">`+md5+`</md5></hash></hashes>
</hashlist>`)

	mkTask := func(p string) *jobmanagertypes.Task {
		abs, err := filepath.Abs(p)
		require.NoError(t, err)
		task, terr := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
			LocalFile:     jobmanagertypes.LocalFile{Path: abs},
			TaskDirection: jobmanagertypes.TaskDirectionUpload,
			JobId:         "job-mixed",
		})
		require.NoError(t, terr)
		return task
	}
	tasks := []*jobmanagertypes.Task{
		mkTask(m1), mkTask(filepath.Join(root, "sub1", "clip.mov")),
		mkTask(m2), mkTask(filepath.Join(root, "sub2", "clip.mov")),
	}

	result := VerifyASCMHL(VerifyRequest{
		Ctx:              context.Background(),
		JobID:            "job-mixed",
		JobName:          "mixed",
		Tasks:            tasks,
		ProfileAlgorithm: constants.AlgorithmNone,
	})
	assert.Equal(t, 2, result.Verified)
	assert.Equal(t, 2, result.Listed)
	assert.Equal(t, 0, result.Problems)
	assert.Equal(t, "mixed", result.Algorithm)
}

// A manifest that cannot be loaded counts as an integrity problem, so a job with
// one unreadable manifest is not shown as cleanly verified.
func TestVerifyASCMHLCountsLoadFailureAsProblem(t *testing.T) {
	root := t.TempDir()
	manifestPath := filepath.Join(root, "ascmhl", "0001_root.mhl")
	// Declares the ASC MHL namespace (so it is detected) but is malformed XML.
	writeFile(t, manifestPath, `<?xml version="1.0" encoding="UTF-8"?>
<hashlist version="2.0" xmlns="urn:ASC:MHL:v2.0"><hashes><hash><path>clip.mov`)

	abs, err := filepath.Abs(manifestPath)
	require.NoError(t, err)
	task, terr := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		LocalFile:     jobmanagertypes.LocalFile{Path: abs},
		TaskDirection: jobmanagertypes.TaskDirectionUpload,
		JobId:         "job-badmanifest",
	})
	require.NoError(t, terr)

	result := VerifyASCMHL(VerifyRequest{
		Ctx:              context.Background(),
		JobID:            "job-badmanifest",
		JobName:          "badmanifest",
		Tasks:            []*jobmanagertypes.Task{task},
		ProfileAlgorithm: constants.AlgorithmNone,
	})
	assert.Equal(t, 1, result.Problems, "a manifest that fails to load is an integrity problem")
	assert.Equal(t, 0, result.Verified)
	assert.Equal(t, 0, result.Listed)
}

// The per-file ASC MHL verification outcome is recorded on the task so a report
// can flag which files failed: "verified" on a match, "mismatch" on a bad hash.
func TestVerifyManifestSetsTaskASCMHLStatus(t *testing.T) {
	root := t.TempDir()
	manifestPath := filepath.Join(root, "ascmhl", "0001_root.mhl")
	writeFile(t, filepath.Join(root, "good.mov"), "good-bytes")
	writeFile(t, filepath.Join(root, "bad.mov"), "bad-bytes")
	goodXX := fmeChecksum(t, filepath.Join(root, "good.mov"), constants.AlgorithmXXHash64)

	mkTask := func(name string) *jobmanagertypes.Task {
		abs, err := filepath.Abs(filepath.Join(root, name))
		require.NoError(t, err)
		task, terr := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
			LocalFile:     jobmanagertypes.LocalFile{Path: abs},
			TaskDirection: jobmanagertypes.TaskDirectionUpload,
			JobId:         "job-status",
		})
		require.NoError(t, terr)
		return task
	}
	goodTask, badTask := mkTask("good.mov"), mkTask("bad.mov")
	goodAbs, _ := filepath.Abs(filepath.Join(root, "good.mov"))
	badAbs, _ := filepath.Abs(filepath.Join(root, "bad.mov"))

	manifest := mhl.ASCManifest{Entries: []mhl.ASCFileEntry{
		{RelativePath: "good.mov", Hashes: map[constants.ChecksumAlgorithm]string{constants.AlgorithmXXHash64: goodXX}},
		{RelativePath: "bad.mov", Hashes: map[constants.ChecksumAlgorithm]string{constants.AlgorithmXXHash64: "deadbeefdeadbeef"}},
	}}

	vctx := verifyCtx{
		ctx:              context.Background(),
		jobID:            "job-status",
		jobName:          "status",
		profileAlgorithm: constants.AlgorithmNone,
		taskByPath:       map[string]*jobmanagertypes.Task{goodAbs: goodTask, badAbs: badTask},
	}
	verifyManifest(vctx, manifestPath, manifest, nil)

	assert.Equal(t, "verified", goodTask.ASCMHLStatus())
	assert.Equal(t, "mismatch", badTask.ASCMHLStatus())
}

// OS-generated sidecar files must be recognized by base name in any subfolder so
// the ASC MHL verify does not flag them as unlisted (log noise for a DIT).
func TestIsOSMetadataFile(t *testing.T) {
	cases := []struct {
		path string
		want bool
	}{
		{"/media/F003/.DS_Store", true},
		{".DS_Store", true},
		{"/media/F003/._F003C003.mxf", true},
		{"/media/F003/Thumbs.db", true},
		{"/media/F003/F003C003_190925_MN99.mxf", false},
		{"/media/F003/notes.DS_Store.txt", false},
		{"/media/F003/ascmhl/0001_F003.mhl", false},
	}
	for _, c := range cases {
		if got := isOSMetadataFile(c.path); got != c.want {
			t.Errorf("isOSMetadataFile(%q) = %v, want %v", c.path, got, c.want)
		}
	}
}
