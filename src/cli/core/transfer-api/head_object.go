package transfer_api

import (
    "context"
    "time"

    "github.com/aws/aws-sdk-go-v2/service/s3"
    "github.com/aws/aws-sdk-go-v2/service/s3/types"
)

type FTHeadObjectOutput struct {
    Metadata      map[string]string
    ContentLength int64
    LastModified  *time.Time
    StorageClass  types.StorageClass
}

func (s3m *S3Manager) HeadObject(prefix string) (*FTHeadObjectOutput, error) {
    result, err := s3m.Client.HeadObject(
        context.TODO(),
        &s3.HeadObjectInput{
            Bucket: &s3m.Bucket,
            Key:    &prefix,
        })
    if err != nil {
        return nil, err
    }
    output := FTHeadObjectOutput{
        Metadata:      result.Metadata,
        ContentLength: *result.ContentLength,
        LastModified:  result.LastModified,
        StorageClass:  result.StorageClass,
    }
    return &output, nil
}

func (s3m *S3Manager) GetMetadata(prefix string) (map[string]string, error) {
    result, err := s3m.Client.HeadObject(
        context.TODO(),
        &s3.HeadObjectInput{
            Bucket: &s3m.Bucket,
            Key:    &prefix,
        })
    if err != nil {
        return nil, err
    }
    return result.Metadata, nil
}

func (s3m *S3Manager) GetContentLength(prefix string) (int64, error) {
    result, err := s3m.Client.HeadObject(
        context.TODO(),
        &s3.HeadObjectInput{
            Bucket: &s3m.Bucket,
            Key:    &prefix,
        })
    if err != nil {
        return 0, err
    }
    return *result.ContentLength, nil
}

func (s3m *S3Manager) GetLastModified(prefix string) (*time.Time, error) {
    result, err := s3m.Client.HeadObject(
        context.TODO(),
        &s3.HeadObjectInput{
            Bucket: &s3m.Bucket,
            Key:    &prefix,
        })
    if err != nil {
        return nil, err
    }
    return result.LastModified, nil
}

func (s3m *S3Manager) GetStorageClass(prefix string) (types.StorageClass, error) {
    result, err := s3m.Client.HeadObject(
        context.TODO(),
        &s3.HeadObjectInput{
            Bucket: &s3m.Bucket,
            Key:    &prefix,
        })
    if err != nil {
        return "", err
    }
    return result.StorageClass, nil
}
