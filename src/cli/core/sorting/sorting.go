package sorting

import (
    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

type FileMoverSorter interface {
    Sort([]*jobmanagertypes.Task) ([]*jobmanagertypes.Task, error)
}
