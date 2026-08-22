package hot_folder

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_keysForHotFolder(t *testing.T) {
	sourceFolder := filepath.Join("tmp", "hot", "folderab")
	nested := filepath.Join(sourceFolder, "sub", "clip.mov")
	tests := []struct {
		name        string
		files       []string
		wantKeys    []string
		wantMatched []string
	}{
		{
			name:        "matches files in the source folder and trims to relative keys",
			files:       []string{filepath.Join(sourceFolder, "a.mov"), nested},
			wantKeys:    []string{"a.mov", filepath.Join("sub", "clip.mov")},
			wantMatched: []string{filepath.Join(sourceFolder, "a.mov"), nested},
		},
		{
			name:        "excludes files outside the source folder",
			files:       []string{filepath.Join("tmp", "other", "b.mov"), filepath.Join(sourceFolder, "c.mov")},
			wantKeys:    []string{"c.mov"},
			wantMatched: []string{filepath.Join(sourceFolder, "c.mov")},
		},
		{
			name:        "returns nothing when no files match",
			files:       []string{filepath.Join("tmp", "other", "d.mov")},
			wantKeys:    nil,
			wantMatched: nil,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			keys, matched := keysForHotFolder(sourceFolder, tt.files)
			assert.Equal(t, tt.wantKeys, keys)
			assert.Equal(t, tt.wantMatched, matched)
		})
	}
}

func Test_trimHotFolderDestinationPath(t *testing.T) {
	type args struct {
		prefix string
		bucket string
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{
			name: "Trims s3 prefix",
			args: args{
				prefix: "s3://my-hot-folder",
				bucket: "test-bucket",
			},
			want: "my-hot-folder",
		},
		{
			name: "Trims s3 prefix and bucket",
			args: args{
				prefix: "s3://test-bucket/my-hot-folder",
				bucket: "test-bucket",
			},
			want: "my-hot-folder",
		},
		{
			name: "Trims uppercase s3 prefix",
			args: args{
				prefix: "S3://my-hot-folder",
				bucket: "test-bucket",
			},
			want: "my-hot-folder",
		},
		{
			name: "Trims uppercase s3 prefix and bucket",
			args: args{
				prefix: "S3://test-bucket/my-hot-folder",
				bucket: "test-bucket",
			},
			want: "my-hot-folder",
		},
		{
			name: "Trims leading slash",
			args: args{
				prefix: "/my-hot-folder",
				bucket: "test-bucket",
			},
			want: "my-hot-folder",
		},
		{
			name: "Gives back same prefix",
			args: args{
				prefix: "my-hot-folder",
				bucket: "test-bucket",
			},
			want: "my-hot-folder",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, trimHotFolderDestinationPath(tt.args.prefix, tt.args.bucket), "trimHotFolderDestinationPath(%v, %v)", tt.args.prefix, tt.args.bucket)
		})
	}
}
