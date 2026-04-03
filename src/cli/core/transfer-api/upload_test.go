package transfer_api

import (
    "context"
    "os"
    "sync"
    "testing"
    "time"

    "github.com/aws/aws-sdk-go-v2/feature/s3/manager"
    "github.com/aws/aws-sdk-go-v2/service/s3/types"
    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/core/transfer-api/mock"
)

func TestS3Manager_Upload(t *testing.T) {
    err := os.MkdirAll("/tmp/TestS3Manager_Upload/", os.ModePerm)
    if err != nil {
        t.Errorf("TestS3Manager_Upload failed creating test dir: %s", err)
    }
    file, err := os.Create("/tmp/TestS3Manager_Upload/file.txt")
    if err != nil {
        t.Errorf("TestS3Manager_Upload failed creating test file: %s", err)
    }
    type fields struct {
        AwsProfile string
        Bucket     string
        Client     FileMoverS3ClientInterface
        Region     string
        Uploader   *manager.Uploader
    }
    type args struct {
        input UploadConfig
    }
    tests := []struct {
        name    string
        fields  fields
        args    args
        wantErr bool
    }{
        {
            name: "Upload API with no Uploader",
            fields: fields{
                AwsProfile: mock.UniteTestMockAWSProfile,
                Bucket:     mock.UnitTestMockBucket,
                Region:     mock.UnitTestMockRegion,
                Uploader:   nil,
            },
            args: args{
                input: UploadConfig{
                    AutoTune:          false,
                    Checksum:          "5fa8d142d3a24dd9448385db95c374ae",
                    ChecksumAlgorithm: "md5",
                    ChunkSize:         5 * constants.MiB,
                    Context:           context.Background(),
                    FilePath:          "/tmp/TestS3Manager_Upload/file.txt",
                    Reader: &FileReader{
                        File:  file,
                        Size:  0,
                        Start: time.Now(),
                    },
                    Destination:  "my/s3/path/to/file.txt",
                    StorageClass: "STANDARD",
                    Threads:      1,
                },
            },
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
                Uploader:   tt.fields.Uploader,
                Lock:       &sync.RWMutex{},
            }
            if _, err := s3m.Upload(tt.args.input); (err != nil) != tt.wantErr {
                t.Errorf("Upload() error = %v, wantErr %v", err, tt.wantErr)
            }
        })
    }
    if err := os.RemoveAll("/tmp/TestS3Manager_Upload"); err != nil {
        t.Errorf("Failed to remove test data files /tmp/TestS3Manager_Upload: %s", err.Error())
    }
}

func Test_convertToAWSStorageClass(t *testing.T) {
    type args struct {
        storageClass string
    }
    tests := []struct {
        name    string
        args    args
        want    types.StorageClass
        wantErr bool
    }{
        {
            name: "Valid storage class",
            args: args{
                storageClass: "Intelligent Tiering",
            },
            want:    types.StorageClassIntelligentTiering,
            wantErr: false,
        },
        {
            name: "Invalid storage class",
            args: args{
                storageClass: "Invalid",
            },
            want:    types.StorageClassStandard,
            wantErr: false,
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := convertToAWSStorageClass(tt.args.storageClass)
            if (err != nil) != tt.wantErr {
                t.Errorf("convertToAWSStorageClass() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            if got != tt.want {
                t.Errorf("convertToAWSStorageClass() got = %v, want %v", got, tt.want)
            }
        })
    }
}
