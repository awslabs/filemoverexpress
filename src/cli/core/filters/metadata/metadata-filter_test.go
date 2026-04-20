package metadata

import (
	"testing"
	"time"

	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

func TestMetadataFilter_IsFiltered(t *testing.T) {
	type (
		args struct {
			task *jobmanagertypes.Task
		}
	)

	downloadTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		S3Object: jobmanagertypes.S3Object{
			Key:          "my/s3/file",
			LastModified: time.Now(),
			Size:         1234,
		},
		TaskDirection: jobmanagertypes.TaskDirectionDownload,
		JobId:         "test-id",
	})
	downloadMetadataTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		S3Object: jobmanagertypes.S3Object{
			Key:          ".DS_Store",
			LastModified: time.Now(),
			Size:         1234,
		},
		TaskDirection: jobmanagertypes.TaskDirectionDownload,
		JobId:         "test-id",
	})

	uploadTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		LocalFile: jobmanagertypes.LocalFile{
			Path:         "/path/to/file.txt",
			Size:         1234,
			LastModified: time.Now(),
		},
		TaskDirection: jobmanagertypes.TaskDirectionUpload,
		JobId:         "test-id",
	})
	uploadMetadataTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		LocalFile: jobmanagertypes.LocalFile{
			Path:         "._metadata_file",
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
				task: downloadMetadataTask,
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
				task: uploadMetadataTask,
			},
			want:    true,
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			metadataFilter := &MetadataFilter{}

			got, err := metadataFilter.IsFiltered(tt.args.task)
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

func TestNewMetadataFilter(t *testing.T) {

	tests := []struct {
		name    string
		wantNil bool
		wantErr bool
	}{
		{
			name:    "[NewMetadataFilter] Should create",
			wantNil: false,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NewMetadataFilter()
			if (err != nil) != tt.wantErr {
				t.Errorf("NewMetadataFilter() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantNil && got != nil {
				t.Errorf("NewMetadataFilter() got = %v, want %v", got, tt.wantNil)
			}
		})
	}
}
