package metadata

import (
	"path"
	"path/filepath"
	"regexp"

	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

var metadataFilePatterns = []*regexp.Regexp{
	regexp.MustCompile(`^\._.*`),
	regexp.MustCompile(`^\.DS_Store$`),
	regexp.MustCompile(`^Thumbs.db$`),
}

// MetadataFilter will exclude files that match the static metadata filters
type MetadataFilter struct {
	filterType s3_sharedv1.SkippedState
}

func (*MetadataFilter) FilteredReason() string {
	return "Matches metadata filter"
}

func (medf *MetadataFilter) SkipType() s3_sharedv1.SkippedState {
	return medf.filterType
}

func (*MetadataFilter) IsFiltered(task *jobmanagertypes.Task) (bool, error) {
	var source string

	if task.TaskDirection() == jobmanagertypes.TaskDirectionDownload {
		source = path.Base(task.S3Object().Key)
	} else if task.TaskDirection() == jobmanagertypes.TaskDirectionUpload {
		source = filepath.Base(task.LocalFile().Path)
	}
	return IsMetadataFileName(source), nil
}

// IsMetadataFileName reports whether a file's base name is an OS-generated
// metadata sidecar (._*, .DS_Store, Thumbs.db). Exported so other code (e.g. the
// ASC MHL verifier's unlisted-file check) matches the same set without a second
// copy of the patterns. Callers pass the base name (path.Base for an S3 key,
// filepath.Base for a local path); the patterns are anchored, so passing a full
// path would only ever match a bare name, never one in a subfolder.
func IsMetadataFileName(baseName string) bool {
	for _, metadataPattern := range metadataFilePatterns {
		if metadataPattern.MatchString(baseName) {
			return true
		}
	}
	return false
}

// NewMetadataFilter returns a new MetadataFilter.
func NewMetadataFilter() (*MetadataFilter, error) {
	return &MetadataFilter{
		s3_sharedv1.SkippedState_SKIPPED_STATE_METADATA,
	}, nil
}
