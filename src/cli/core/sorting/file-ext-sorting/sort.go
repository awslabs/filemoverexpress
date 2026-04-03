package file_ext_sorting

import (
    "strings"

    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

func (fes *FileExtSorting) Sort(tasks []*jobmanagertypes.Task) ([]*jobmanagertypes.Task, error) {
    fes.output = make([]*jobmanagertypes.Task, 0)
    fes.filtered = make(map[string]bool)
    for _, fExt := range fes.extOrder {
        for _, task := range tasks {
            fes.sortTask(task, fExt)
        }
    }

    // Copy the output to a local temporary variable, so we can clean up
    // and free up memory in case the sorter instance sticks around
    output := fes.output
    fes.output = nil
    fes.filtered = nil

    return output, nil
}

func (fes *FileExtSorting) sortTask(task *jobmanagertypes.Task, ext string) {
    lf := task.GetSourcePath()

    if ext == "*" {
        if !fes.filtered[lf] {
            fes.output = append(fes.output, task)
            return
        }
    }

    if strings.HasSuffix(lf, ext) {
        fes.filtered[lf] = true
        fes.output = append(fes.output, task)
    }
}
