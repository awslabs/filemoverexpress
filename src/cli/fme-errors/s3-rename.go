package fme_errors

import "errors"

var (
	ErrConvertStorageClass             = errors.New("could not interpret storage class")
	ErrRenameFromEmptyPath             = errors.New("cannot rename empty S3 path or root S3 path")
	ErrRenameToEmptyPath               = errors.New("cannot rename to an empty S3 path or root S3 path")
	ErrRenameToExistingObject          = errors.New("object with new name already exists")
	ErrRenameToExistingPrefix          = errors.New("prefix with new name already exists")
	ErrGettingObject                   = errors.New("object to rename does not exist")
	ErrGettingObjectsInPrefix          = errors.New("error occurred when finding objects in prefix to rename")
	ErrInvalidRenameStorageClassObject = errors.New("object has storage class that is not supported by rename")
	ErrInvalidRenameStorageClassPrefix = errors.New("a child object has storage class that is not supported by rename")
	ErrRenameErrorsOccurred            = errors.New("check logs for specific errors")
	ErrMultipartCopyIncomplete         = errors.New("aborting incomplete multipart upload to copy object")
	ErrCompletingMultipartCopy         = errors.New("error completing copy")
)
