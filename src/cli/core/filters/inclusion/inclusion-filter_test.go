package inclusion

import (
	"reflect"
	"regexp"
	"testing"
	"time"

	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

func TestInclusionFilter_IsFiltered(t *testing.T) {
	type (
		fields struct {
			filterStr string
		}
		args struct {
			task *jobmanagertypes.Task
		}
	)

	downloadTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		S3Object: jobmanagertypes.S3Object{
			Key:          "prefix/sub-prefix/my-remote-file",
			LastModified: time.Now(),
			Size:         1234,
		},
		TaskDirection: jobmanagertypes.TaskDirectionDownload,
		JobId:         "test-id",
	})

	uploadTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		LocalFile: jobmanagertypes.LocalFile{
			Path:         "/path/to/my-local-file",
			Size:         1234,
			LastModified: time.Now(),
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
			name: "[Download] file should be included",
			fields: fields{
				filterStr: "my-remote-file",
			},
			args: args{
				task: downloadTask,
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "[Download] file should be excluded",
			fields: fields{
				filterStr: "invalid-filename",
			},
			args: args{
				task: downloadTask,
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "[Upload] file should be included",
			fields: fields{
				filterStr: "my-local-file",
			},
			args: args{
				task: uploadTask,
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "[Upload] file should be excluded",
			fields: fields{
				filterStr: "my-remote-file",
			},
			args: args{
				task: uploadTask,
			},
			want:    true,
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rgx, err := regexp.Compile(tt.fields.filterStr)
			if err != nil {
				t.Errorf("IsFiltered() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			iflt := &InclusionFilter{
				filterRgx:  rgx,
				filterType: s3_sharedv1.SkippedState_SKIPPED_STATE_INCLUSION_FILTER,
			}

			got, err := iflt.IsFiltered(tt.args.task)
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

func TestNewInclusionFilter(t *testing.T) {
	type args struct {
		filterStr string
	}

	tests := []struct {
		name    string
		args    args
		want    string
		wantNil bool
		wantErr bool
	}{
		{
			name: "[NewInclusionFilter] Should create",
			args: args{
				filterStr: ".*",
			},
			want:    ".*",
			wantNil: false,
			wantErr: false,
		},
		{
			name: "[NewInclusionFilter] Should fail on invalid regex",
			args: args{
				filterStr: "[.",
			},
			want:    "",
			wantNil: true,
			wantErr: true,
		},
		{
			name: "[NewInclusionFilter] Should return nil on empty regex",
			args: args{
				filterStr: "",
			},
			want:    "",
			wantNil: true,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NewInclusionFilter(tt.args.filterStr)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewInclusionFilter() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if tt.wantNil {
				if got != nil {
					t.Errorf("NewInclusionFilter() got = %v, want %v", got, tt.wantNil)
				}
				return
			}
			if !tt.wantErr && !reflect.DeepEqual(got.filterRgx.String(), tt.want) {
				t.Errorf("NewInclusionFilter() got = %v, want %v", got, tt.want)
			}
		})
	}
}
