package fme_errors

import "errors"

var (
    ErrJobCancelled         = errors.New("cancelled")
    ErrJobPaused            = errors.New("paused")
    ErrNoSuchJob            = errors.New("no such job found")
    ErrCannotClearActiveJob = errors.New("active jobs cannot be cleared")
)
