package transfer_api

import (
	"reflect"
	"sync"
	"testing"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/awslabs/filemoverexpress/core/transfer-api/mock"
)

func ConvertListObjectsOutput(input s3.ListObjectsV2Output) ListObjectsOutput {
	var s3Objects []S3Object
	for _, object := range input.Contents {
		listObj := S3Object{
			Key:          *object.Key,
			LastModified: object.LastModified,
			Metadata:     nil,
			Size:         *object.Size,
			StorageClass: string(object.StorageClass),
		}
		s3Objects = append(s3Objects, listObj)
	}
	return ListObjectsOutput{
		S3Objects: s3Objects,
	}
}

func ConvertListObjectsAndFoldersOutput(input s3.ListObjectsV2Output) ListObjectsAndFolderOutput {
	var s3Objects []S3Object
	var folders []string
	for _, object := range input.Contents {
		if *input.Prefix != *object.Key {
			listObj := S3Object{
				Key:          *object.Key,
				LastModified: object.LastModified,
				Metadata:     nil,
				Size:         *object.Size,
				StorageClass: string(object.StorageClass),
			}
			s3Objects = append(s3Objects, listObj)
		}
	}
	for _, folder := range input.CommonPrefixes {
		folders = append(folders, *folder.Prefix)
	}
	return ListObjectsAndFolderOutput{
		S3Objects: s3Objects,
		S3Folders: folders,
	}
}

func ConvertListObjectsOutputWithMetadata(input s3.ListObjectsV2Output) ListObjectsOutput {
	metadata := mock.HeadObjectSuccessful().Metadata
	var s3Objects []S3Object
	for _, object := range input.Contents {
		s3Object := S3Object{
			Key:          *object.Key,
			LastModified: object.LastModified,
			Metadata:     metadata,
			Size:         *object.Size,
			StorageClass: string(object.StorageClass),
		}
		s3Objects = append(s3Objects, s3Object)
	}
	return ListObjectsOutput{S3Objects: s3Objects}
}

func TestS3Manager_ListObjects(t *testing.T) {
	type fields struct {
		AwsProfile string
		Bucket     string
		Client     *s3.Client
		Region     string
	}
	type args struct {
		prefix string
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		want    ListObjectsOutput
		wantErr bool
	}{
		{
			name: "List Objects",
			fields: fields{
				AwsProfile: mock.UniteTestMockAWSProfile,
				Bucket:     mock.UnitTestMockBucket,
				Region:     mock.UnitTestMockRegion,
			},
			args: args{
				prefix: mock.UnitTestFolderPrefix,
			},
			want:    ConvertListObjectsOutput(*mock.ListObjectsV2Successful()),
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s3m := &S3Manager{
				AwsProfile: tt.fields.AwsProfile,
				Bucket:     tt.fields.Bucket,
				Client:     &mock.FileMoverS3Client{},
				Region:     tt.fields.Region,
				Lock:       &sync.RWMutex{},
			}
			got, err := s3m.ListObjects(tt.args.prefix)
			if (err != nil) != tt.wantErr {
				t.Errorf("ListObjects() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("ListObjects() got = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestS3Manager_ListObjectsAndFolders(t *testing.T) {
	type fields struct {
		AwsProfile string
		Bucket     string
		Client     *s3.Client
		Region     string
	}
	type args struct {
		prefix string
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		want    ListObjectsAndFolderOutput
		wantErr bool
	}{
		{
			name: "List Objects and folders",
			fields: fields{
				AwsProfile: mock.UniteTestMockAWSProfile,
				Bucket:     mock.UnitTestMockBucket,
				Region:     mock.UnitTestMockRegion,
			},
			args: args{
				prefix: mock.UnitTestFolderPrefix,
			},
			want:    ConvertListObjectsAndFoldersOutput(*mock.ListObjectsV2Successful()),
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s3m := &S3Manager{
				AwsProfile: tt.fields.AwsProfile,
				Bucket:     tt.fields.Bucket,
				Client:     &mock.FileMoverS3Client{},
				Region:     tt.fields.Region,
				Lock:       &sync.RWMutex{},
			}
			got, err := s3m.ListObjectsAndFolders(tt.args.prefix, "/")
			if (err != nil) != tt.wantErr {
				t.Errorf("ListObjects() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("ListObjects() got = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestS3Manager_ListObjectsWithMetadata(t *testing.T) {
	type fields struct {
		AwsProfile string
		Bucket     string
		Client     *s3.Client
		Region     string
	}
	type args struct {
		prefix string
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		want    ListObjectsOutput
		wantErr bool
	}{
		{
			name: "ListObjects with metadata",
			fields: fields{
				AwsProfile: mock.UniteTestMockAWSProfile,
				Bucket:     mock.UnitTestMockBucket,
				Region:     mock.UnitTestMockRegion,
			},
			args: args{
				prefix: mock.UnitTestFolderPrefix,
			},
			want:    ConvertListObjectsOutputWithMetadata(*mock.ListObjectsV2Successful()),
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s3m := &S3Manager{
				AwsProfile: tt.fields.AwsProfile,
				Bucket:     tt.fields.Bucket,
				Client:     &mock.FileMoverS3Client{},
				Region:     tt.fields.Region,
				Lock:       &sync.RWMutex{},
			}
			got, err := s3m.ListObjectsWithMetadata(tt.args.prefix)
			if (err != nil) != tt.wantErr {
				t.Errorf("ListObjects() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("ListObjects() got = %v, want %v", got, tt.want)
			}
		})
	}
}
