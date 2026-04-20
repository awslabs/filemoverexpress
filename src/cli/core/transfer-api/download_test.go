package transfer_api

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/core/transfer-api/mock"
)

func TestS3Manager_Download(t *testing.T) {
	err := os.MkdirAll("/tmp/TestS3Manager_Download", os.ModePerm)
	if err != nil {
		t.Errorf("TestS3Manager_Download failed creating test dir: %s", err)
	}
	file, err := os.Create("/tmp/TestS3Manager_Download/temp.txt")
	if err != nil {
		t.Errorf("TestS3Manager_Download failed creating test file: %s", err)
	}
	type fields struct {
		AwsProfile string
		Bucket     string
		Client     FileMoverS3ClientInterface
		Downloader *manager.Downloader
		Region     string
	}
	type args struct {
		input DownloadConfig
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		want    int64
		wantErr bool
	}{
		{
			name: "Download with no downloader",
			fields: fields{
				AwsProfile: mock.UniteTestMockAWSProfile,
				Bucket:     mock.UnitTestMockBucket,
				Region:     mock.UnitTestMockRegion,
				Downloader: nil,
			},
			args: args{
				input: DownloadConfig{
					AutoTune:  false,
					ChunkSize: 5 * constants.MiB,
					Context:   context.Background(),
					Key:       mock.UnitTestFileNameWithPrefix,
					Writer: &FileWriter{
						File:  file,
						Size:  0,
						Start: time.Now(),
					},
					Threads: 1,
				},
			},
			want:    19,
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s3m := &S3Manager{
				AwsProfile: tt.fields.AwsProfile,
				Bucket:     tt.fields.Bucket,
				Client:     &mock.FileMoverS3Client{},
				Downloader: tt.fields.Downloader,
				Region:     tt.fields.Region,
				Lock:       &sync.RWMutex{},
			}
			got, err := s3m.Download(tt.args.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("Download() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("Download() got = %v, want %v", got, tt.want)
			}
		})
	}
	if err := os.RemoveAll("/tmp/TestS3Manager_Download"); err != nil {
		t.Logf("TestS3Manager_Download failed removing test dir: %s", err)
	}
}
