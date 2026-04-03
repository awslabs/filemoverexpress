package transfer_api

import (
    "reflect"
    "sync"
    "testing"

    "github.com/awslabs/filemoverexpress/core/transfer-api/mock"
)

func TestS3Manager_HeadObject(t *testing.T) {
    type fields struct {
        AwsProfile string
        Bucket     string
        Client     FileMoverS3Client
        Region     string
    }
    type args struct {
        prefix string
    }
    tests := []struct {
        name    string
        fields  fields
        args    args
        want    FTHeadObjectOutput
        wantErr bool
    }{
        {
            name: "HeadObject Should Succeed",
            fields: fields{
                AwsProfile: mock.UniteTestMockAWSProfile,
                Bucket:     mock.UnitTestMockBucket,
                Region:     mock.UnitTestMockRegion,
            },
            args: args{
                prefix: mock.UnitTestFileName,
            },
            want: FTHeadObjectOutput{
                Metadata:      mock.HeadObjectSuccessful().Metadata,
                ContentLength: 1048576,
                LastModified:  mock.HeadObjectSuccessful().LastModified,
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
                Lock:       &sync.RWMutex{},
            }
            got, err := s3m.HeadObject(tt.args.prefix)
            if (err != nil) != tt.wantErr {
                t.Errorf("HeadObject() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            if !reflect.DeepEqual(*got, tt.want) {
                t.Errorf("HeadObject() got = %v, want %v", got, tt.want)
            }
        })
    }
}

func TestS3Manager_GetMetadata(t *testing.T) {
    type fields struct {
        AwsProfile string
        Bucket     string
        Client     FileMoverS3Client
        Region     string
    }
    type args struct {
        prefix string
    }
    tests := []struct {
        name    string
        fields  fields
        args    args
        want    map[string]string
        wantErr bool
    }{
        {
            name: "GetMetadata Should Succeed",
            fields: fields{
                AwsProfile: mock.UniteTestMockAWSProfile,
                Bucket:     mock.UnitTestMockBucket,
                Region:     mock.UnitTestMockRegion,
            },
            args: args{
                prefix: mock.UnitTestFileName,
            },
            want:    mock.HeadObjectSuccessful().Metadata,
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
            got, err := s3m.GetMetadata(tt.args.prefix)
            if (err != nil) != tt.wantErr {
                t.Errorf("HeadObject() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            if !reflect.DeepEqual(got, tt.want) {
                t.Errorf("HeadObject() got = %v, want %v", got, tt.want)
            }
        })
    }
}

func TestS3Manager_GetContentLength(t *testing.T) {
    type fields struct {
        AwsProfile string
        Bucket     string
        Client     FileMoverS3Client
        Region     string
    }
    type args struct {
        prefix string
    }
    tests := []struct {
        name    string
        fields  fields
        args    args
        want    int64
        wantErr bool
    }{
        {
            name: "GetContentLength Should Succeed",
            fields: fields{
                AwsProfile: mock.UniteTestMockAWSProfile,
                Bucket:     mock.UnitTestMockBucket,
                Region:     mock.UnitTestMockRegion,
            },
            args: args{
                prefix: mock.UnitTestFileName,
            },
            want:    1048576,
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
            got, err := s3m.GetContentLength(tt.args.prefix)
            if (err != nil) != tt.wantErr {
                t.Errorf("GetContentLength() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            if !reflect.DeepEqual(got, tt.want) {
                t.Errorf("GetContentLength() got = %v, want %v", got, tt.want)
            }
        })
    }
}
