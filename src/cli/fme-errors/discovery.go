package fme_errors

import "errors"

var (
    ErrSourceIsSymlink = errors.New("symbolic links are not supported by S3")
)
