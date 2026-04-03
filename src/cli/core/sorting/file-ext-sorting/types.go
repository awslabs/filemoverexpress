package file_ext_sorting

import (
    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

type FileExtSorting struct {
    extOrder []string
    output   []*jobmanagertypes.Task
    filtered map[string]bool
}
