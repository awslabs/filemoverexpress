package inclusion

import (
    "fmt"
    "regexp"
    "strings"

    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
    "github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

type InclusionFilter struct {
    filterRgx  *regexp.Regexp
    filterType s3_sharedv1.SkippedState
}

//revive:disable:receiver-naming
func (*InclusionFilter) FilteredReason() string {
    return "Does not match inclusion filter"
}

//revive:enable:receiver-naming

func (iflt *InclusionFilter) SkipType() s3_sharedv1.SkippedState {
    return iflt.filterType
}
func (iflt *InclusionFilter) IsFiltered(taskInput *jobmanagertypes.Task) (bool, error) {
    var source string

    if taskInput.TaskDirection() == jobmanagertypes.TaskDirectionDownload {
        source = taskInput.S3Object().Key
    } else if taskInput.TaskDirection() == jobmanagertypes.TaskDirectionUpload {
        source = taskInput.LocalFile().Path
    }

    return !iflt.filterRgx.MatchString(source), nil
}

func NewInclusionFilter(filterStr string) (*InclusionFilter, error) {
    filterStr = strings.TrimSpace(filterStr)
    if filterStr == "" {
        return nil, nil
    }

    rgx, err := regexp.Compile(filterStr)
    if err != nil {
        return nil, fmt.Errorf("failed to compile inclusion filter regular expression: %w", err)
    }

    return &InclusionFilter{
        filterRgx:  rgx,
        filterType: s3_sharedv1.SkippedState_SKIPPED_STATE_INCLUSION_FILTER,
    }, nil
}
