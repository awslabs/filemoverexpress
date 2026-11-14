package mhl_processor

import (
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
	strASCReadError  = "Failed to compute %s checksum for %s while verifying against ASC MHL: %s"
	strASCSummary    = "ASC MHL verification complete for %s: %d verified, %d mismatched, %d missing, %d not-honored"
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

// verifyCounts tallies the outcome of verifying one manifest. verifyCtx carries
// the per-job verification context so the manifest/entry helpers stay within the
// argument-count limit.
type (
	verifyCounts struct {
		verified   int
		mismatched int
		missing    int
		unhonored  int
	}

	verifyCtx struct {
		jobID            string
		jobName          string
		profileAlgorithm constants.ChecksumAlgorithm
	}
)

// integrityProblems are the outcomes that mean the offload cannot be trusted as
// delivered: a file whose bytes do not match the manifest, or a listed file that
// is not on disk. These drive the job to JobStatusCompletedWithWarnings and are
// surfaced as job-scoped error log lines (red, in the job's Logs tab).
func (c verifyCounts) integrityProblems() int {
	return c.mismatched + c.missing
}

// VerifyASCMHL verifies every file listed in the latest-generation ASC MHL
// manifest(s) present in the task set. For each entry that exists on disk it
// re-hashes the source in an algorithm the manifest carries (preferring the
// profile's own algorithm) and compares it to the manifest value. It ALWAYS
// re-hashes and compares; it never trusts a manifest hash without checking the
// bytes.
//
// Returns the number of integrity problems found (hash mismatches plus
// manifest-listed files missing on disk) across all manifests, so the caller can
// mark the job JobStatusCompletedWithWarnings. Each such problem is emitted as a
// job-scoped error event (so it appears, in red, in that job's Logs tab) AND
// written to the daemon log. Verified and not-honored outcomes are logged too.
func VerifyASCMHL(jobID, jobName string, tasks []*jobmanagertypes.Task, profileAlgorithm constants.ChecksumAlgorithm) int {
	ctx := verifyCtx{jobID: jobID, jobName: jobName, profileAlgorithm: profileAlgorithm}
	problems := 0
	for _, manifestPath := range latestASCGenerations(ascManifestPaths(tasks)) {
		manifest, err := mhl.LoadASCMHLFile(manifestPath)
		if err != nil {
			emitJobError(jobID, jobName, fmt.Sprintf(strASCLoadFailed, manifestPath, err))
			continue
		}
		counts := verifyManifest(ctx, manifestPath, manifest)
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

func verifyManifest(ctx verifyCtx, manifestPath string, manifest mhl.ASCManifest) verifyCounts {
	root := ascRoot(manifestPath)
	var counts verifyCounts

	for _, entry := range manifest.Entries {
		absPath := entryAbsPath(root, entry.RelativePath)

		if _, err := os.Stat(absPath); err != nil {
			// Missing file: an incomplete offload. Loud, job-scoped, red.
			emitJobError(ctx.jobID, ctx.jobName, fmt.Sprintf(strASCMissing, entry.RelativePath, manifestPath))
			counts.missing++
			continue
		}

		verifyEntry(ctx, entry, absPath, &counts)
	}

	// Summary line to the daemon log + global stream (job-less is fine; the
	// per-file problems above already carry the jobId for the job's Logs tab).
	events.Events.Info(strASCSummary, manifestPath, counts.verified, counts.mismatched, counts.missing, counts.unhonored)
	logger.Info(strASCSummary, manifestPath, counts.verified, counts.mismatched, counts.missing, counts.unhonored)

	return counts
}

func verifyEntry(ctx verifyCtx, entry mhl.ASCFileEntry, absPath string, counts *verifyCounts) {
	algo, expected, ok := pickVerifyAlgorithm(entry, ctx.profileAlgorithm)
	if !ok {
		// Not an integrity failure - FME simply cannot compute the manifest's
		// algorithm (e.g. sha1-only). Warn, but do not flag the job.
		msg := fmt.Sprintf(strASCUnhonored, entry.RelativePath, strings.Join(entry.UnsupportedAlgos, ", "))
		events.Events.Warn("%s", msg)
		logger.Warn("%s", msg)
		counts.unhonored++
		return
	}

	checksummer, err := checksums.NewChecksummer(algo)
	if err != nil {
		msg := fmt.Sprintf(strASCReadError, algo, entry.RelativePath, err)
		events.Events.Error("%s", msg)
		logger.Error("%s", msg)
		counts.unhonored++
		return
	}

	computed, err := checksummer.ChecksumFile(absPath)
	if err != nil {
		msg := fmt.Sprintf(strASCReadError, algo, entry.RelativePath, err)
		events.Events.Error("%s", msg)
		logger.Error("%s", msg)
		counts.unhonored++
		return
	}

	if checksumsEqual(algo, computed, expected) {
		events.Events.Info(strASCVerified, entry.RelativePath, algo)
		logger.Info(strASCVerified, entry.RelativePath, algo)
		counts.verified++
		return
	}

	// Hash mismatch: possible corruption. Loud, job-scoped, red.
	emitJobError(ctx.jobID, ctx.jobName, fmt.Sprintf(strASCMismatch, entry.RelativePath, algo, expected, computed))
	counts.mismatched++
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
// profile's own algorithm when the manifest carries it (so the verification
// matches what the transfer attaches), otherwise the fastest available from
// verifyPriority. Returns the chosen algorithm and the manifest's expected value.
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
