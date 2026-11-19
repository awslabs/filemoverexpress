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
	var name string

	// Match on the base name. The patterns are anchored (^...$), so matching them
	// against a full path never caught a metadata file in a subfolder - only a
	// bare ".DS_Store". S3 keys are always forward-slash separated, local paths
	// use the OS separator.
	if task.TaskDirection() == jobmanagertypes.TaskDirectionDownload {
		name = path.Base(task.S3Object().Key)
	} else if task.TaskDirection() == jobmanagertypes.TaskDirectionUpload {
		name = filepath.Base(task.LocalFile().Path)
	}
	for _, metadataPattern := range metadataFilePatterns {
		if metadataPattern.MatchString(name) {
			return true, nil
		}
	}
	return false, nil
}

// NewMetadataFilter returns a new MetadataFilter.
func NewMetadataFilter() (*MetadataFilter, error) {
	return &MetadataFilter{
		s3_sharedv1.SkippedState_SKIPPED_STATE_METADATA,
	}, nil
}
