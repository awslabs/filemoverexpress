package file_already_exists

import (
    "testing"

    "github.com/awslabs/filemoverexpress/types/configtypes"
    "github.com/awslabs/filemoverexpress/types/databasetypes"
    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
    "github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

func TestFileAlreadyExistsFilter_FilteredReason(t *testing.T) {
    type fields struct {
        db *databasetypes.Database
    }
    job, _ := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
        Name: "test-job-file-already-exists",
        TransferProfile: &configtypes.TransferProfile{
            Name:    "test",
            Bucket:  "test-bucket",
            Region:  "us-west-2",
            Profile: "test-profile",
            Checksums: configtypes.ChecksumSettings{
                Enabled:   true,
                Algorithm: "md5",
            },
        },
    })
    tests := []struct {
        name   string
        fields fields
        want   string
    }{
        {
            name: "FilteredReason() should return expected string",
            fields: fields{
                db: nil,
            },
            want: strSkippingAlreadyDownloadedFile,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            fi := &FileAlreadyExistsFilter{
                job: job,
                db:  tt.fields.db,
            }
            if got := fi.FilteredReason(); got != tt.want {
                t.Errorf("FilteredReason() = %v, want %v", got, tt.want)
            }
        })
    }
}

func TestFileAlreadyExistsFilter_SkipType(t *testing.T) {
    type fields struct {
        db *databasetypes.Database
    }
    job, _ := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
        Name: "test-job-file-already-exists",
        TransferProfile: &configtypes.TransferProfile{
            Name:    "test",
            Bucket:  "test-bucket",
            Region:  "us-west-2",
            Profile: "test-profile",
            Checksums: configtypes.ChecksumSettings{
                Enabled:   true,
                Algorithm: "md5",
            },
        },
    })

    tests := []struct {
        name   string
        fields fields
        want   s3_sharedv1.SkippedState
    }{
        {
            name: "Test SkipType",
            fields: fields{
                db: nil,
            },
            want: s3_sharedv1.SkippedState_SKIPPED_STATE_ALREADY_EXISTS,
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            fi := &FileAlreadyExistsFilter{
                job: job,
                db:  tt.fields.db,
            }
            if got := fi.SkipType(); got != tt.want {
                t.Errorf("SkipType() = %v, want %v", got, tt.want)
            }
        })
    }
}

func TestNewFileAlreadyExistsFilter(t *testing.T) {
    job, _ := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
        Name: "test-job-file-already-exists",
        TransferProfile: &configtypes.TransferProfile{
            Name:    "test",
            Bucket:  "test-bucket",
            Region:  "us-west-2",
            Profile: "test-profile",
            Checksums: configtypes.ChecksumSettings{
                Enabled:   true,
                Algorithm: "md5",
            },
        },
    })
    tests := []struct {
        name    string
        wantErr bool
    }{
        {
            name:    "NewFileAlreadyExistsFilter should return a valid instance",
            wantErr: false,
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            _, err := NewFileAlreadyExistsFilter(job)
            if (err != nil) != tt.wantErr {
                t.Errorf("NewFileAlreadyExistsFilter() error = %v, wantErr %v. Err: %s", err, tt.wantErr, err)
                return
            }
        })
    }
}
