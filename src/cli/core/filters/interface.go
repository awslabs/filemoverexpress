package filters

import (
    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
    "github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

type FileMoverFilter interface {
    IsFiltered(source *jobmanagertypes.Task) (bool, error)
    FilteredReason() string
    SkipType() s3_sharedv1.SkippedState
}
