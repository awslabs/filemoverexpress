package checksum_manager

import (
	"reflect"
	"testing"
	"time"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/types/databasetypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

func Test_createCacheRecord(t *testing.T) {
	type args struct {
		fileInfo  jobmanagertypes.LocalFile
		checksum  string
		algorithm constants.ChecksumAlgorithm
	}

	now := time.Now()

	tests := []struct {
		name string
		args args
		want databasetypes.ChecksumRecord
	}{
		{
			name: "Create cache record",
			args: args{
				fileInfo: jobmanagertypes.LocalFile{
					LastModified: now,
					Path:         "/path/to/file",
					Size:         1234,
				},
				checksum:  "0f0ebba9bf2e53a503884302899dd746",
				algorithm: constants.AlgorithmMD5,
			},
			want: databasetypes.ChecksumRecord{
				Size:         1234,
				LastModified: now,
				MD5Hex:       "0f0ebba9bf2e53a503884302899dd746",
				XXHash:       "",
				XXHash64:     "",
				XXH3:         "",
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := createCacheRecord(tt.args.fileInfo, tt.args.checksum, tt.args.algorithm); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("createCacheRecord() = %v, want %v", got, tt.want)
			}
		})
	}
}
