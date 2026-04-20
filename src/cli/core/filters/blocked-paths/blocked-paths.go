package blocked_paths

import (
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
	"github.com/awslabs/filemoverexpress/utils/fs/fsbrowser"
)

// TODO: write unit tests for this filter

// BlockedPathsFilter will exclude files that match the static metadata filters
type BlockedPathsFilter struct {
	blockedPaths []string
	filterType   s3_sharedv1.SkippedState
}

func (*BlockedPathsFilter) FilteredReason() string {
	return "Contains a blocked path"
}

func (blpf *BlockedPathsFilter) SkipType() s3_sharedv1.SkippedState {
	return blpf.filterType
}

func (blpf *BlockedPathsFilter) IsFiltered(task *jobmanagertypes.Task) (bool, error) {
	var localPath string
	if task.TaskDirection() == jobmanagertypes.TaskDirectionDownload {
		localPath = task.Destination()
	} else {
		localPath = task.LocalFile().Path
	}
	return fsbrowser.ShouldExcludeDirEntry(localPath, blpf.blockedPaths), nil
}

// NewBlockedPathsFilter returns a new BlockedPathsFilter.
func NewBlockedPathsFilter(blockedPaths []string) (*BlockedPathsFilter, error) {
	return &BlockedPathsFilter{
		blockedPaths: blockedPaths,
		filterType:   s3_sharedv1.SkippedState_SKIPPED_STATE_BLOCKED_PATH,
	}, nil
}
