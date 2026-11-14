package mhl_processor

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/core/checksums"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/utils/mhl"
)

const (
	strASCLoadFailed = "Failed to read ASC MHL manifest %s: %s"
	strASCMissing    = "ASC MHL lists %s but it is missing on disk (manifest %s)"
	strASCVerified   = "Verified %s against supplied ASC MHL (%s)"
	strASCMismatch   = "%s does NOT match the hash in the supplied ASC MHL (%s): expected %s, computed %s"
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

// verifyCounts tallies the outcome of verifying one manifest.
type verifyCounts struct {
	verified   int
	mismatched int
	missing    int
	unhonored  int
}

// VerifyASCMHL verifies every file listed in the latest-generation ASC MHL
// manifest(s) present in the task set. For each entry that exists on disk it
// re-hashes the source in an algorithm the manifest carries (preferring the
// profile's own algorithm) and compares it to the manifest value. Files listed
// but missing on disk, and files whose only hashes are algorithms FME cannot
// compute (sha1, xxh128), are reported.
//
// This ALWAYS re-hashes and compares; it never trusts a manifest hash without
// checking the bytes. Every outcome is emitted to the event bus (GUI) and to
// the daemon log, because a connected GUI client suppresses the bus's own log
// write.
func VerifyASCMHL(tasks []*jobmanagertypes.Task, profileAlgorithm constants.ChecksumAlgorithm) {
	for _, manifestPath := range latestASCGenerations(ascManifestPaths(tasks)) {
		manifest, err := mhl.LoadASCMHLFile(manifestPath)
		if err != nil {
			emit(events.Events.Warn, logger.Warn, strASCLoadFailed, manifestPath, err)
			continue
		}
		verifyManifest(manifestPath, manifest, profileAlgorithm)
	}
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
			emit(events.Events.Warn, logger.Warn, strASCLoadFailed, localFilePath, err)
			continue
		}
		if isASC {
			paths = append(paths, localFilePath)
		}
	}
	return paths
}

func verifyManifest(manifestPath string, manifest mhl.ASCManifest, profileAlgorithm constants.ChecksumAlgorithm) verifyCounts {
	root := ascRoot(manifestPath)
	var counts verifyCounts

	for _, entry := range manifest.Entries {
		absPath := entryAbsPath(root, entry.RelativePath)

		if _, err := os.Stat(absPath); err != nil {
			emit(events.Events.Warn, logger.Warn, strASCMissing, entry.RelativePath, manifestPath)
			counts.missing++
			continue
		}

		verifyEntry(entry, absPath, profileAlgorithm, &counts)
	}

	emit(events.Events.Info, logger.Info, strASCSummary, manifestPath,
		counts.verified, counts.mismatched, counts.missing, counts.unhonored)

	return counts
}

func verifyEntry(entry mhl.ASCFileEntry, absPath string, profileAlgorithm constants.ChecksumAlgorithm, counts *verifyCounts) {
	algo, expected, ok := pickVerifyAlgorithm(entry, profileAlgorithm)
	if !ok {
		emit(events.Events.Warn, logger.Warn, strASCUnhonored, entry.RelativePath, strings.Join(entry.UnsupportedAlgos, ", "))
		counts.unhonored++
		return
	}

	checksummer, err := checksums.NewChecksummer(algo)
	if err != nil {
		emit(events.Events.Error, logger.Error, strASCReadError, algo, entry.RelativePath, err)
		counts.unhonored++
		return
	}

	computed, err := checksummer.ChecksumFile(absPath)
	if err != nil {
		emit(events.Events.Error, logger.Error, strASCReadError, algo, entry.RelativePath, err)
		counts.unhonored++
		return
	}

	if checksumsEqual(algo, computed, expected) {
		emit(events.Events.Info, logger.Info, strASCVerified, entry.RelativePath, algo)
		counts.verified++
		return
	}

	emit(events.Events.Error, logger.Error, strASCMismatch, entry.RelativePath, algo, expected, computed)
	counts.mismatched++
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

// emit sends the same formatted message to both the event bus (GUI) and the
// daemon log. When a GUI client is connected the event bus does not also write
// to the log, so the explicit logger call is what guarantees an audit trail.
func emit(toBus, toLog func(string, ...interface{}), message string, args ...interface{}) {
	toBus(message, args...)
	toLog(message, args...)
}
