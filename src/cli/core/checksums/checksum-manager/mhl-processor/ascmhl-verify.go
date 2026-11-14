package mhl_processor

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/core/checksums"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/utils/mhl"
)

const (
	strASCLoadFailed = "Failed to read ASC MHL manifest %s: %s"
	strASCMissing    = "ASC MHL lists %s but it is MISSING on disk - the offload is incomplete (manifest %s)"
	strASCVerified   = "Verified %s against supplied ASC MHL (%s)"
	strASCMismatch   = "%s does NOT match the hash in the supplied ASC MHL (%s): expected %s, computed %s - possible corruption"
	strASCUnhonored  = "Could not honor the ASC MHL hash for %s: no FME-supported algorithm present (manifest has: %s)"
	strASCUnreadable = "Could not read %s to verify it against the supplied ASC MHL (%s): %s"
	strASCEscape     = "ASC MHL entry %s escapes the offload tree and was NOT verified (manifest %s)"
	strASCFlagged    = "The only ASC MHL hash(es) for %s are marked bad by the writer (%s) - treating as unverified"
	strASCExtra      = "%s is present on disk but is NOT listed in the supplied ASC MHL (manifest %s)"
	strASCSummary    = "ASC MHL verify for %s: %d verified, %d integrity problems, %d unlisted, %d not-honored"
)

// verifyPriority is the order in which FME-supported algorithms are chosen to
// verify a file on ingest when the profile's own algorithm is not one the
// manifest carries. Faster hashes are preferred; C4 (SHA-512 based) is last.
var verifyPriority = []constants.ChecksumAlgorithm{
	constants.AlgorithmXXHash64,
	constants.AlgorithmXXH3,
	constants.AlgorithmMD5,
	constants.AlgorithmC4,
}

type (
	// verifyCounts tallies the outcome of verifying one manifest.
	verifyCounts struct {
		verified   int
		mismatched int
		missing    int
		unreadable int
		rejected   int
		flagged    int
		notListed  int
		unhonored  int
	}

	// verifyCtx carries the per-job verification context so the manifest/entry
	// helpers stay within the argument-count limit.
	verifyCtx struct {
		ctx              context.Context
		jobID            string
		jobName          string
		profileAlgorithm constants.ChecksumAlgorithm
		// precomputed maps an absolute file path to a checksum FRESHLY computed
		// from the file's bytes by the worker pool in this pass (in
		// profileAlgorithm). Reused instead of re-reading the file. It never
		// contains a hash imported from a legacy MHL or the cache, so verification
		// always reflects the bytes on disk right now.
		precomputed map[string]string
	}

	// VerifyRequest is the input to VerifyASCMHL. Precomputed carries only
	// freshly-hashed (worker-pool) checksums keyed by absolute path; an imported
	// or cached checksum must NOT be placed here, or a tampered file could be
	// "verified" against a stale hash.
	VerifyRequest struct {
		Ctx              context.Context
		JobID            string
		JobName          string
		Tasks            []*jobmanagertypes.Task
		ProfileAlgorithm constants.ChecksumAlgorithm
		Precomputed      map[string]string
	}
)

// integrityProblems are the outcomes that mean the offload cannot be trusted as
// delivered: a mismatch, a missing file, a file that could not be read, an entry
// whose path escaped the offload tree, or a file whose only recorded hash the
// writer itself marked bad. "not-listed" and "not-honored" are surfaced as
// warnings but do not, on their own, flag the job. These drive the job to
// JobStatusCompletedWithWarnings.
func (c verifyCounts) integrityProblems() int {
	return c.mismatched + c.missing + c.unreadable + c.rejected + c.flagged
}

// VerifyASCMHL verifies every file listed in the latest-generation ASC MHL
// manifest(s) present in the task set. For each entry it re-hashes the source
// (reusing only a hash freshly computed from the bytes in this pass when the
// algorithm matches the profile) and compares it to the manifest value. It never
// trusts a manifest hash without checking the bytes, and never reuses an imported
// or cached checksum.
//
// Returns the number of integrity problems found across all manifests so the
// caller can mark the job JobStatusCompletedWithWarnings. Each problem is emitted
// as a job-scoped error event (red, in the job's Logs tab) AND written to the
// daemon log. Honors ctx cancellation: a cancelled job stops verifying.
func VerifyASCMHL(req VerifyRequest) int {
	vctx := verifyCtx{
		ctx:              req.Ctx,
		jobID:            req.JobID,
		jobName:          req.JobName,
		profileAlgorithm: req.ProfileAlgorithm,
		precomputed:      req.Precomputed,
	}

	problems := 0
	for _, manifestPath := range latestASCGenerations(ascManifestPaths(req.Tasks)) {
		if req.Ctx.Err() != nil {
			break
		}
		manifest, err := mhl.LoadASCMHLFile(manifestPath)
		if err != nil {
			emitJobError(req.JobID, req.JobName, fmt.Sprintf(strASCLoadFailed, manifestPath, err))
			continue
		}
		counts := verifyManifest(vctx, manifestPath, manifest, req.Tasks)
		problems += counts.integrityProblems()
	}
	return problems
}

// ascManifestPaths returns the ASC MHL manifest paths among the tasks.
func ascManifestPaths(tasks []*jobmanagertypes.Task) []string {
	paths := make([]string, 0)
	for _, task := range tasks {
		localFilePath := task.LocalFile().Path
		if strings.ToLower(filepath.Ext(localFilePath)) != ".mhl" {
			continue
		}
		isASC, err := mhl.IsASCMHL(localFilePath)
		if err != nil {
			logger.Warn(strASCLoadFailed, localFilePath, err)
			continue
		}
		if isASC {
			paths = append(paths, localFilePath)
		}
	}
	return paths
}

func verifyManifest(vctx verifyCtx, manifestPath string, manifest mhl.ASCManifest, tasks []*jobmanagertypes.Task) verifyCounts {
	root := ascRoot(manifestPath)
	var counts verifyCounts
	listed := make(map[string]bool, len(manifest.Entries))

	for _, entry := range manifest.Entries {
		if vctx.ctx.Err() != nil {
			return counts
		}

		absPath, ok := safeEntryPath(root, entry.RelativePath)
		if !ok {
			// Path escapes the offload tree (e.g. "../../x"). Never stat or hash it.
			emitJobError(vctx.jobID, vctx.jobName, fmt.Sprintf(strASCEscape, entry.RelativePath, manifestPath))
			counts.rejected++
			continue
		}
		listed[absPath] = true

		if _, err := os.Stat(absPath); err != nil {
			emitJobError(vctx.jobID, vctx.jobName, fmt.Sprintf(strASCMissing, entry.RelativePath, manifestPath))
			counts.missing++
			continue
		}

		// Defend against a symlink inside the tree that points outside it:
		// resolve both ends and re-check containment before hashing.
		if !resolvedUnder(root, absPath) {
			emitJobError(vctx.jobID, vctx.jobName, fmt.Sprintf(strASCEscape, entry.RelativePath, manifestPath))
			counts.rejected++
			continue
		}

		verifyEntry(vctx, entry, absPath, &counts)
	}

	reportUnlistedFiles(manifestPath, tasks, listed, &counts)

	events.Events.Info(strASCSummary, manifestPath, counts.verified, counts.integrityProblems(), counts.notListed, counts.unhonored)
	logger.Info(strASCSummary, manifestPath, counts.verified, counts.integrityProblems(), counts.notListed, counts.unhonored)

	return counts
}

func verifyEntry(vctx verifyCtx, entry mhl.ASCFileEntry, absPath string, counts *verifyCounts) {
	algo, expected, ok := pickVerifyAlgorithm(entry, vctx.profileAlgorithm)
	if !ok {
		if len(entry.RejectedActions) > 0 {
			// The only hashes the manifest has for this file were marked bad by
			// the writer (e.g. action="failed") - treat that as an integrity
			// problem, not a benign skip.
			emitJobError(vctx.jobID, vctx.jobName,
				fmt.Sprintf(strASCFlagged, entry.RelativePath, strings.Join(entry.RejectedActions, ", ")))
			counts.flagged++
			return
		}
		// Not an integrity failure - FME simply cannot compute the manifest's
		// algorithm (e.g. sha1-only). Warn, but do not flag the job.
		msg := fmt.Sprintf(strASCUnhonored, entry.RelativePath, strings.Join(entry.UnsupportedAlgos, ", "))
		events.Events.Warn("%s", msg)
		logger.Warn("%s", msg)
		counts.unhonored++
		return
	}

	computed, err := computeOrReuse(vctx, algo, absPath)
	if err != nil {
		// An unreadable listed file cannot be verified - that is an integrity
		// problem, not a benign skip.
		emitJobError(vctx.jobID, vctx.jobName, fmt.Sprintf(strASCUnreadable, entry.RelativePath, algo, err))
		counts.unreadable++
		return
	}

	if checksumsEqual(algo, computed, expected) {
		events.Events.Info(strASCVerified, entry.RelativePath, algo)
		logger.Info(strASCVerified, entry.RelativePath, algo)
		counts.verified++
		return
	}

	emitJobError(vctx.jobID, vctx.jobName, fmt.Sprintf(strASCMismatch, entry.RelativePath, algo, expected, computed))
	counts.mismatched++
}

// computeOrReuse returns the file's checksum in algo, reusing ONLY a hash the
// worker pool freshly computed from the bytes in this pass when algo is the
// profile algorithm (avoiding a second read). A legacy-MHL-imported or cached
// checksum is never placed in precomputed, so this never verifies a file against
// a hash that was not read from the current bytes.
func computeOrReuse(vctx verifyCtx, algo constants.ChecksumAlgorithm, absPath string) (string, error) {
	if algo == vctx.profileAlgorithm {
		if sum, ok := vctx.precomputed[absPath]; ok {
			return sum, nil
		}
	}
	checksummer, err := checksums.NewChecksummer(algo)
	if err != nil {
		return "", err
	}
	return checksummer.ChecksumFile(absPath)
}

// reportUnlistedFiles warns about media files being transferred under this
// manifest's root that the manifest does not list (the ASC reference tool flags
// these). A not-listed file is a warning, not an integrity failure.
func reportUnlistedFiles(
	manifestPath string,
	tasks []*jobmanagertypes.Task,
	listed map[string]bool,
	counts *verifyCounts,
) {
	root := ascRoot(manifestPath)
	ascmhlDir := filepath.Join(root, "ascmhl")
	for _, task := range tasks {
		path := task.LocalFile().Path
		if strings.ToLower(filepath.Ext(path)) == ".mhl" {
			continue
		}
		abs, err := filepath.Abs(path)
		if err != nil {
			continue
		}
		// The ascmhl/ folder itself travels with the media (manifests + the chain
		// file). The ASC reference tool ignores it, so neither the chain file nor
		// anything else under ascmhl/ is "unlisted".
		if isUnder(ascmhlDir, abs) {
			continue
		}
		if !isUnder(root, abs) || listed[abs] {
			continue
		}
		rel, relErr := filepath.Rel(root, abs)
		if relErr != nil {
			rel = abs
		}
		msg := fmt.Sprintf(strASCExtra, rel, manifestPath)
		events.Events.Warn("%s", msg)
		logger.Warn("%s", msg)
		counts.notListed++
	}
}

// resolvedUnder resolves symlinks on both the root and the path and reports
// whether the path still lands inside the root. This catches a symlink inside
// the offload tree that points outside it (safeEntryPath is only lexical).
// Both ends are resolved so a symlinked root (e.g. macOS /var -> /private/var)
// does not cause a false escape.
func resolvedUnder(root, abs string) bool {
	resolvedRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		resolvedRoot = root
	}
	resolvedAbs, err := filepath.EvalSymlinks(abs)
	if err != nil {
		// Could not resolve (e.g. broken link). Fall back to the lexical result.
		return isUnder(root, abs)
	}
	return isUnder(resolvedRoot, resolvedAbs)
}

// safeEntryPath joins a manifest-supplied relative path onto the offload root and
// rejects any path that escapes the root (path traversal). ASC MHL paths are
// relative to the parent of the ascmhl/ folder; a malicious or malformed manifest
// must never make the daemon stat or hash files outside that tree.
func safeEntryPath(root, relPath string) (string, bool) {
	abs := filepath.Clean(filepath.Join(root, relPath))
	if !isUnder(root, abs) {
		return "", false
	}
	return abs, true
}

// isUnder reports whether abs is root itself or a descendant of root.
func isUnder(root, abs string) bool {
	rel, err := filepath.Rel(root, abs)
	if err != nil {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)))
}

// emitJobError raises a job-scoped error event (rendered red in the job's Logs
// tab) and mirrors it to the daemon log. Used for integrity problems so a DIT
// sees named, alarming lines on the job that failed verification.
func emitJobError(jobID, jobName, message string) {
	events.Events.Send(&eventtypes.JobErrorEvent{
		Id:        jobID,
		Name:      jobName,
		ErrorTime: time.Now(),
		Err:       errors.New(message),
	})
	logger.Error("%s", message)
}

// pickVerifyAlgorithm chooses which algorithm to verify with. It prefers the
// profile's own algorithm when the manifest carries it (so the checksum the
// normal pass already computed can be reused), otherwise the fastest available
// from verifyPriority. Returns the chosen algorithm and the manifest's value.
func pickVerifyAlgorithm(entry mhl.ASCFileEntry, profileAlgorithm constants.ChecksumAlgorithm) (constants.ChecksumAlgorithm, string, bool) {
	if value, ok := entry.Hashes[profileAlgorithm]; ok {
		return profileAlgorithm, value, true
	}
	for _, algo := range verifyPriority {
		if value, ok := entry.Hashes[algo]; ok {
			return algo, value, true
		}
	}
	return "", "", false
}

// checksumsEqual compares a freshly computed checksum against a manifest value.
// Hex-based algorithms are compared case-insensitively with leading zeros
// normalized, because ASC MHL zero-pads hex digests (e.g. xxh64 to 16 chars)
// while FME formats them as the minimal-width integer. C4 IDs are base58 and are
// compared verbatim.
func checksumsEqual(algo constants.ChecksumAlgorithm, computed, manifest string) bool {
	if algo == constants.AlgorithmC4 {
		return strings.TrimSpace(computed) == strings.TrimSpace(manifest)
	}
	return normalizeHex(computed) == normalizeHex(manifest)
}

func normalizeHex(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.TrimLeft(s, "0")
	if s == "" {
		return "0"
	}
	return s
}
