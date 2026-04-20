package max_age

import (
	"time"

	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

// MaxAgeFilter will exclude files that are not within the maximum age range
type MaxAgeFilter struct {
	maxAge     int64
	cutoff     int64
	filterType s3_sharedv1.SkippedState
}

//revive:disable:receiver-naming
func (*MaxAgeFilter) FilteredReason() string {
	return "Older than max age"
}

//revive:enable:receiver-naming

func (maf *MaxAgeFilter) SkipType() s3_sharedv1.SkippedState {
	return maf.filterType
}

func (maf *MaxAgeFilter) IsFiltered(taskInput *jobmanagertypes.Task) (bool, error) {
	var lastModified int64

	if taskInput.TaskDirection() == jobmanagertypes.TaskDirectionUpload {
		lastModified = taskInput.LocalFile().LastModified.Unix()
	} else if taskInput.TaskDirection() == jobmanagertypes.TaskDirectionDownload {
		lastModified = taskInput.S3Object().LastModified.Unix()
	}
	return lastModified < maf.cutoff, nil
}

// NewMaxAgeFilter returns a new MaxAgeFilter configured with the provided maxAge value. If maxAge is unset (zero value) returns a nil value
// for the point, to signal that the filter is disabled
func NewMaxAgeFilter(maxAge int64) (*MaxAgeFilter, error) {
	if maxAge <= 0 {
		return nil, nil
	}

	return &MaxAgeFilter{
		maxAge:     maxAge,
		cutoff:     time.Now().Add(time.Duration(maxAge) * time.Second * -1).Unix(),
		filterType: s3_sharedv1.SkippedState_SKIPPED_STATE_MAX_AGE,
	}, nil
}
