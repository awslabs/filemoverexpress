package max_age

import (
	"reflect"
	"testing"
	"time"

	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

func TestNewMaxAgeFilter(t *testing.T) {
	type args struct {
		maxAge int64
	}

	tests := []struct {
		name    string
		args    args
		want    *MaxAgeFilter
		wantNil bool
	}{
		{
			name: "Should return a filter when provided a valid maxAge",
			args: args{
				maxAge: 60,
			},
			want: &MaxAgeFilter{
				maxAge:     60,
				cutoff:     time.Now().Add(time.Duration(60) * time.Second * -1).Unix(),
				filterType: s3_sharedv1.SkippedState_SKIPPED_STATE_MAX_AGE,
			},
			wantNil: false,
		},
		{
			name: "Should return a nil value when provided an invalid maxAge",
			args: args{
				maxAge: 0,
			},
			want:    nil,
			wantNil: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, _ := NewMaxAgeFilter(tt.args.maxAge)

			if tt.wantNil {
				if got != nil {
					t.Errorf("NewMaxAgeFilter() got = %v, want %v", got, tt.wantNil)
				}
				return
			}

			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("NewMaxAgeFilter() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestMaxAgeFilter_Filter(t *testing.T) {
	curTime := time.Now()
	type fields struct {
		maxAge int64
	}
	type args struct {
		task *jobmanagertypes.Task
	}
	downloadIncludedTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		S3Object: jobmanagertypes.S3Object{
			Key:          "prefix/path/to/object.txt",
			Size:         4321,
			LastModified: curTime,
		},
		TaskDirection: jobmanagertypes.TaskDirectionDownload,
		JobId:         "test-id",
	})
	downloadExcludedTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		S3Object: jobmanagertypes.S3Object{
			Key:          "prefix/path/to/object.txt",
			Size:         4321,
			LastModified: curTime.Add(time.Duration(1000) * time.Second * -1),
		},
		TaskDirection: jobmanagertypes.TaskDirectionDownload,
		JobId:         "test-id",
	})
	uploadIncludedTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		LocalFile: jobmanagertypes.LocalFile{
			Path:         "/path/to/file.txt",
			Size:         1234,
			LastModified: curTime,
		},
		TaskDirection: jobmanagertypes.TaskDirectionUpload,
		JobId:         "test-id",
	})
	uploadExcludedTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		LocalFile: jobmanagertypes.LocalFile{
			Path:         "/path/to/file.txt",
			Size:         1234,
			LastModified: curTime.Add(time.Duration(1000) * time.Second * -1),
		},
		TaskDirection: jobmanagertypes.TaskDirectionUpload,
		JobId:         "test-id",
	})
	tests := []struct {
		name    string
		fields  fields
		args    args
		want    bool
		wantErr bool
	}{
		{
			name: "[Download] File should be included",
			fields: fields{
				maxAge: 60,
			},
			args: args{
				task: downloadIncludedTask,
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "[Download] File should be excluded",
			fields: fields{
				maxAge: 60,
			},
			args: args{
				task: downloadExcludedTask,
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "[Upload] File should be included",
			fields: fields{
				maxAge: 60,
			},
			args: args{
				task: uploadIncludedTask,
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "[Upload] File should be excluded",
			fields: fields{
				maxAge: 60,
			},
			args: args{
				task: uploadExcludedTask,
			},
			want:    true,
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			maf, _ := NewMaxAgeFilter(tt.fields.maxAge)
			got, err := maf.IsFiltered(tt.args.task)
			if (err != nil) != tt.wantErr {
				t.Errorf("Filter() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("Filter() got = %v, want %v", got, tt.want)
			}
		})
	}
}
