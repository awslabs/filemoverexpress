package fme_errors

import "errors"

var (
    ErrDeleteEmptyPath          = errors.New("cannot delete empty S3 path or root S3 path")
    ErrGetObjectVersions        = errors.New("error getting object versions")
    ErrDeleteErrorsOccurred     = errors.New("check logs for specific errors")
    ErrNoObjectVersionsToDelete = errors.New("found no object versions or delete markers to delete")
)
