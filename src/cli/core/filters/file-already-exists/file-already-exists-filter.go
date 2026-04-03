package file_already_exists

import (
    "errors"
    "os"

    ftErrors "github.com/awslabs/filemoverexpress/fme-errors"
    "github.com/awslabs/filemoverexpress/types/databasetypes"
    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
    "github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

type FileAlreadyExistsFilter struct {
    job *jobmanagertypes.Job
    db  *databasetypes.Database
}

func (*FileAlreadyExistsFilter) FilteredReason() string {
    return strSkippingAlreadyDownloadedFile
}

func (*FileAlreadyExistsFilter) SkipType() s3_sharedv1.SkippedState {
    return s3_sharedv1.SkippedState_SKIPPED_STATE_ALREADY_EXISTS
}

func (faef *FileAlreadyExistsFilter) IsFiltered(task *jobmanagertypes.Task) (bool, error) {
    fInfo, err := os.Stat(task.Destination())
    if err != nil {
        return false, nil
    }

    dbObj, err := faef.getDbRecord(task)
    if err != nil {
        if errors.Is(err, ftErrors.ErrDBNoSuchKey) {
            return false, nil
        }

        return false, err
    }

    if dbObj.Size == fInfo.Size() && (fInfo.ModTime().Before(dbObj.LastModified) || fInfo.ModTime().Equal(dbObj.LastModified)) {
        return true, nil
    }

    return false, nil
}

func (faef *FileAlreadyExistsFilter) getDbRecord(task *jobmanagertypes.Task) (*databasetypes.DatabaseObject, error) {
    if faef.job == nil {
        return nil, ftErrors.ErrNoSuchJob
    }

    rf := task.S3Object()
    dest := task.Destination()

    dbKey := databasetypes.BuildKey(faef.job.TransferProfile().Bucket, rf.Key, dest)
    dbObj, err := faef.db.FindObject(dbKey)
    if err != nil {
        return nil, err
    }

    return &dbObj, nil
}

func NewFileAlreadyExistsFilter(job *jobmanagertypes.Job) (*FileAlreadyExistsFilter, error) {
    db, err := databasetypes.New()
    if err != nil {
        return nil, err
    }

    return &FileAlreadyExistsFilter{
        job: job,
        db:  db,
    }, nil
}
