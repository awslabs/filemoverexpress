package hot_folder

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

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
