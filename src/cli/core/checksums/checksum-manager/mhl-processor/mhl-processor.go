package mhl_processor

import (
	"path/filepath"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/utils/mhl"
)

// ProcessMHLFiles scans a slice of tasks for MHL manifests (legacy
// mediahashlist.org v1.0 and ASC MHL v2) and returns a map keyed by the absolute
// local file path whose value is the file's checksum in the requested algorithm.
// If the requested algorithm is not present for a file in the manifest, that file
// is treated as if it were not listed (i.e. FME configuration wants XXHash
// checksums but the MHL only carries MD5). Importing these values lets FME skip
// re-hashing the source: the value flows into the destination comparison, which
// is where source-vs-manifest integrity is actually confirmed.
//
// Independent on-ingest verification of ASC MHL entries whose hash is in a
// different (but FME-supported) algorithm is handled by VerifyASCMHL.
func ProcessMHLFiles(tasks []*jobmanagertypes.Task, algorithm constants.ChecksumAlgorithm) (map[string]string, []error) {
	result := make(map[string]string)
	mhlErrors := make([]error, 0)

	ascManifests := make([]string, 0)
	for _, task := range tasks {
		localFilePath := task.LocalFile().Path
		if filepath.Ext(localFilePath) != ".mhl" {
			continue
		}

		isASC, err := mhl.IsASCMHL(localFilePath)
		if err != nil {
			mhlErrors = append(mhlErrors, err)
			continue
		}
		if isASC {
			ascManifests = append(ascManifests, localFilePath)
			continue
		}

		if err := importLegacyMHL(localFilePath, algorithm, result); err != nil {
			mhlErrors = append(mhlErrors, err)
		}
	}

	for _, manifestPath := range latestASCGenerations(ascManifests) {
		if err := importASCMHL(manifestPath, algorithm, result); err != nil {
			mhlErrors = append(mhlErrors, err)
		}
	}

	return result, mhlErrors
}

// importLegacyMHL imports the requested-algorithm hashes from a legacy v1.0
// hashlist into result, keyed by absolute file path.
func importLegacyMHL(mhlPath string, algorithm constants.ChecksumAlgorithm, result map[string]string) error {
	mhlBasePath := filepath.Dir(mhlPath)
	hashList, err := mhl.LoadMHLFile(mhlPath)
	if err != nil {
		return err
	}

	for _, itm := range hashList.HashList {
		itmFullPath := filepath.Clean(filepath.Join(mhlBasePath, itm.File))
		if value := legacyHashForAlgorithm(itm, algorithm); value != "" {
			result[itmFullPath] = value
		}
	}
	return nil
}

func legacyHashForAlgorithm(itm mhl.Hash, algorithm constants.ChecksumAlgorithm) string {
	switch algorithm {
	case constants.AlgorithmMD5:
		return itm.MD5
	case constants.AlgorithmXXHash:
		return itm.XXHash
	case constants.AlgorithmXXHash64:
		return itm.XXHash64
	case constants.AlgorithmXXH3:
		return itm.XXH3
	default:
		return ""
	}
}

// importASCMHL imports the requested-algorithm hashes from an ASC MHL v2 manifest
// into result, keyed by absolute file path. ASC MHL paths are relative to the
// parent of the ascmhl/ folder (ascRoot).
func importASCMHL(manifestPath string, algorithm constants.ChecksumAlgorithm, result map[string]string) error {
	manifest, err := mhl.LoadASCMHLFile(manifestPath)
	if err != nil {
		return err
	}

	root := ascRoot(manifestPath)
	for _, entry := range manifest.Entries {
		if value, ok := entry.Hashes[algorithm]; ok {
			result[entryAbsPath(root, entry.RelativePath)] = value
		}
	}
	return nil
}

// ascRoot returns the root of the hashed tree for an ASC MHL manifest: the parent
// of the ascmhl/ folder the manifest lives in.
func ascRoot(manifestPath string) string {
	return filepath.Dir(filepath.Dir(manifestPath))
}

func entryAbsPath(root, relPath string) string {
	return filepath.Clean(filepath.Join(root, relPath))
}

// latestASCGenerations groups ASC MHL manifest paths by their ascmhl/ directory
// and returns only the latest-generation manifest in each. Generation manifests
// are named with a leading zero-padded sequence number (0001_, 0002_, ...), so
// the lexicographically greatest base name is the newest generation.
func latestASCGenerations(manifestPaths []string) []string {
	latestByDir := make(map[string]string)
	for _, p := range manifestPaths {
		dir := filepath.Dir(p)
		if current, ok := latestByDir[dir]; !ok || filepath.Base(p) > filepath.Base(current) {
			latestByDir[dir] = p
		}
	}

	chosen := make([]string, 0, len(latestByDir))
	for _, p := range latestByDir {
		chosen = append(chosen, p)
	}
	return chosen
}
