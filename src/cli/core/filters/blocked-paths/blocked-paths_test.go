package blocked_paths

import (
    "testing"
    "time"

    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

func TestBlockedPathsFilter_IsFiltered(t *testing.T) {
    type (
        args struct {
            task *jobmanagertypes.Task
        }
    )
    filename := "/tmp/TestBlockedPathsFilter_IsFiltered/file.txt"
    blockedfilename := "/tmp/TestBlockedPathsFilter_IsFiltered/.aws/file.txt"
    secondBlockedFilename := "/dev/blockedpath.txt"

    downloadTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
        S3Object: jobmanagertypes.S3Object{
            Key:          "my/s3/file",
            LastModified: time.Now(),
            Size:         1234,
        },
        Destination:   filename,
        TaskDirection: jobmanagertypes.TaskDirectionDownload,
        JobId:         "test-id",
    })
    downloadBlockedPathsTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
        S3Object: jobmanagertypes.S3Object{
            Key:          "my/s3/file",
            LastModified: time.Now(),
            Size:         1234,
        },
        Destination:   blockedfilename,
        TaskDirection: jobmanagertypes.TaskDirectionDownload,
        JobId:         "test-id",
    })

    uploadTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
        LocalFile: jobmanagertypes.LocalFile{
            Path:         filename,
            Size:         1234,
            LastModified: time.Now(),
        },
        TaskDirection: jobmanagertypes.TaskDirectionUpload,
        JobId:         "test-id",
    })
    uploadBlockedPathsTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
        LocalFile: jobmanagertypes.LocalFile{
            Path:         secondBlockedFilename,
            Size:         1234,
            LastModified: time.Now(),
        },
        TaskDirection: jobmanagertypes.TaskDirectionUpload,
        JobId:         "test-id",
    })

    tests := []struct {
        name    string
        args    args
        want    bool
        wantErr bool
    }{
        {
            name: "[Download] file should be included",
            args: args{
                task: downloadTask,
            },
            want:    false,
            wantErr: false,
        },
        {
            name: "[Download] file should be excluded",
            args: args{
                task: downloadBlockedPathsTask,
            },
            want:    true,
            wantErr: false,
        },
        {
            name: "[Upload] file should be included",
            args: args{
                task: uploadTask,
            },
            want:    false,
            wantErr: false,
        },
        {
            name: "[Upload] file should be excluded",
            args: args{
                task: uploadBlockedPathsTask,
            },
            want:    true,
            wantErr: false,
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            blockedPathsFilter := &BlockedPathsFilter{blockedPaths: []string{".aws", "/dev"}}

            got, err := blockedPathsFilter.IsFiltered(tt.args.task)
            if (err != nil) != tt.wantErr {
                t.Errorf("IsFiltered() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            if got != tt.want {
                t.Errorf("IsFiltered() got = %v, want %v", got, tt.want)
            }
        })
    }
}

func TestNewBlockedPathsFilter(t *testing.T) {

    tests := []struct {
        name    string
        wantNil bool
        wantErr bool
    }{
        {
            name:    "[NewBlockedPathsFilter] Should create",
            wantNil: false,
            wantErr: false,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := NewBlockedPathsFilter([]string{})
            if (err != nil) != tt.wantErr {
                t.Errorf("NewBlockedPathsFilter() error = %v, wantErr %v", err, tt.wantErr)
            }
            if tt.wantNil && got != nil {
                t.Errorf("NewBlockedPathsFilter() got = %v, want %v", got, tt.wantNil)
            }
        })
    }
}
