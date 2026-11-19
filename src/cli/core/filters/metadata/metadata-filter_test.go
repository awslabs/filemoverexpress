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

// Regression: the patterns are anchored, so matching them against a full path
// never caught a metadata file in a subfolder. Match on the base name instead.
func TestMetadataFilter_NestedPaths(t *testing.T) {
	filter, _ := NewMetadataFilter()

	cases := []struct {
		name      string
		direction jobmanagertypes.TaskDirection
		upload    string
		s3key     string
		want      bool
	}{
		{"[Upload] nested .DS_Store excluded", jobmanagertypes.TaskDirectionUpload, "/media/F003MN99/.DS_Store", "", true},
		{"[Upload] nested ._ fork excluded", jobmanagertypes.TaskDirectionUpload, "/media/F003MN99/._clip.mxf", "", true},
		{"[Upload] nested Thumbs.db excluded", jobmanagertypes.TaskDirectionUpload, "/media/F003MN99/Thumbs.db", "", true},
		{"[Upload] real media kept", jobmanagertypes.TaskDirectionUpload, "/media/F003MN99/clip.mxf", "", false},
		{"[Download] nested .DS_Store excluded", jobmanagertypes.TaskDirectionDownload, "", "offload/F003MN99/.DS_Store", true},
		{"[Download] real media kept", jobmanagertypes.TaskDirectionDownload, "", "offload/F003MN99/clip.mxf", false},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			cfg := jobmanagertypes.TaskConfig{TaskDirection: c.direction, JobId: "test-id"}
			if c.direction == jobmanagertypes.TaskDirectionUpload {
				cfg.LocalFile = jobmanagertypes.LocalFile{Path: c.upload, Size: 1}
			} else {
				cfg.S3Object = jobmanagertypes.S3Object{Key: c.s3key, Size: 1, LastModified: time.Now()}
			}
			task, err := jobmanagertypes.NewTask(cfg)
			if err != nil {
				t.Fatalf("NewTask: %v", err)
			}
			got, err := filter.IsFiltered(task)
			if err != nil {
				t.Fatalf("IsFiltered: %v", err)
			}
			if got != c.want {
				t.Errorf("IsFiltered(%q%q) = %v, want %v", c.upload, c.s3key, got, c.want)
			}
		})
	}
}
