package transfer_api

import (
    "context"

    "github.com/aws/aws-sdk-go-v2/service/s3"
)

type (
    FileMoverS3Client struct {
        client *s3.Client
    }

    FileMoverS3ClientInterface interface {
        HeadObject(context.Context, *s3.HeadObjectInput, ...func(*s3.Options)) (*s3.HeadObjectOutput, error)
        ListObjectsV2(context.Context, *s3.ListObjectsV2Input, ...func(*s3.Options)) (*s3.ListObjectsV2Output, error)
        PutObject(context.Context, *s3.PutObjectInput, ...func(*s3.Options)) (*s3.PutObjectOutput, error)
        UploadPart(context.Context, *s3.UploadPartInput, ...func(*s3.Options)) (*s3.UploadPartOutput, error)
        CreateMultipartUpload(
            context.Context, *s3.CreateMultipartUploadInput, ...func(*s3.Options)) (*s3.CreateMultipartUploadOutput, error)
        CompleteMultipartUpload(
            context.Context, *s3.CompleteMultipartUploadInput, ...func(*s3.Options)) (*s3.CompleteMultipartUploadOutput, error)
        AbortMultipartUpload(context.Context, *s3.AbortMultipartUploadInput, ...func(*s3.Options)) (*s3.AbortMultipartUploadOutput, error)
        GetObject(context.Context, *s3.GetObjectInput, ...func(*s3.Options)) (*s3.GetObjectOutput, error)
        DeleteObject(context.Context, *s3.DeleteObjectInput, ...func(*s3.Options)) (*s3.DeleteObjectOutput, error)
        DeleteObjects(context.Context, *s3.DeleteObjectsInput, ...func(*s3.Options)) (*s3.DeleteObjectsOutput, error)
        CopyObject(context.Context, *s3.CopyObjectInput, ...func(options *s3.Options)) (*s3.CopyObjectOutput, error)
        UploadPartCopy(context.Context, *s3.UploadPartCopyInput, ...func(options *s3.Options)) (*s3.UploadPartCopyOutput, error)
        ListObjectVersions(context.Context, *s3.ListObjectVersionsInput, ...func(options *s3.Options)) (*s3.ListObjectVersionsOutput, error)
    }
)

func (f *FileMoverS3Client) DeleteObject(ctx context.Context, params *s3.DeleteObjectInput,
    optFns ...func(*s3.Options)) (*s3.DeleteObjectOutput, error) {
    return f.client.DeleteObject(ctx, params, optFns...)
}

func (f *FileMoverS3Client) DeleteObjects(ctx context.Context, params *s3.DeleteObjectsInput,
    optFns ...func(*s3.Options)) (*s3.DeleteObjectsOutput, error) {
    return f.client.DeleteObjects(ctx, params, optFns...)
}

func (f *FileMoverS3Client) HeadObject(ctx context.Context, params *s3.HeadObjectInput,
    optFns ...func(*s3.Options)) (*s3.HeadObjectOutput, error) {
    return f.client.HeadObject(ctx, params, optFns...)
}

func (f *FileMoverS3Client) ListObjectsV2(ctx context.Context, params *s3.ListObjectsV2Input,
    optFns ...func(*s3.Options)) (*s3.ListObjectsV2Output,
    error) {
    return f.client.ListObjectsV2(ctx, params, optFns...)
}

func (f *FileMoverS3Client) PutObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput,
    error) {
    return f.client.PutObject(ctx, params, optFns...)
}

func (f *FileMoverS3Client) UploadPart(ctx context.Context, params *s3.UploadPartInput,
    optFns ...func(*s3.Options)) (*s3.UploadPartOutput, error) {
    return f.client.UploadPart(ctx, params, optFns...)
}

func (f *FileMoverS3Client) CreateMultipartUpload(ctx context.Context, params *s3.CreateMultipartUploadInput,
    optFns ...func(*s3.Options)) (*s3.CreateMultipartUploadOutput, error) {
    return f.client.CreateMultipartUpload(ctx, params, optFns...)
}

func (f *FileMoverS3Client) CompleteMultipartUpload(ctx context.Context, params *s3.CompleteMultipartUploadInput,
    optFns ...func(*s3.Options)) (*s3.CompleteMultipartUploadOutput, error) {
    return f.client.CompleteMultipartUpload(ctx, params, optFns...)
}
func (f *FileMoverS3Client) AbortMultipartUpload(ctx context.Context, params *s3.AbortMultipartUploadInput,
    optFns ...func(*s3.Options)) (*s3.AbortMultipartUploadOutput, error) {
    return f.client.AbortMultipartUpload(ctx, params, optFns...)
}

func (f *FileMoverS3Client) GetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput,
    error) {
    return f.client.GetObject(ctx, params, optFns...)
}

func (f *FileMoverS3Client) CopyObject(ctx context.Context, params *s3.CopyObjectInput,
    optFns ...func(options *s3.Options)) (*s3.CopyObjectOutput, error) {
    return f.client.CopyObject(ctx, params, optFns...)
}

func (f *FileMoverS3Client) UploadPartCopy(ctx context.Context, params *s3.UploadPartCopyInput,
    optFns ...func(options *s3.Options)) (*s3.UploadPartCopyOutput, error) {
    return f.client.UploadPartCopy(ctx, params, optFns...)
}

func (f *FileMoverS3Client) ListObjectVersions(ctx context.Context, params *s3.ListObjectVersionsInput,
    optFns ...func(options *s3.Options)) (*s3.ListObjectVersionsOutput, error) {
    return f.client.ListObjectVersions(ctx, params, optFns...)
}
