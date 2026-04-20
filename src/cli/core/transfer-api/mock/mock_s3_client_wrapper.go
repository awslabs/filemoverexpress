package mock

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type FileMoverS3Client struct {
	*s3.Client
}

func (*FileMoverS3Client) DeleteObject(_ context.Context, _ *s3.DeleteObjectInput,
	_ ...func(*s3.Options)) (*s3.DeleteObjectOutput, error) {
	return deleteObjectSuccessful(), nil
}

func (*FileMoverS3Client) HeadObject(_ context.Context, _ *s3.HeadObjectInput,
	_ ...func(*s3.Options)) (*s3.HeadObjectOutput, error) {
	return HeadObjectSuccessful(), nil
}

func (*FileMoverS3Client) ListObjectsV2(
	context.Context,
	*s3.ListObjectsV2Input, ...func(*s3.Options),
) (*s3.ListObjectsV2Output, error) {
	return ListObjectsV2Successful(), nil
}

func (*FileMoverS3Client) PutObject(_ context.Context, _ *s3.PutObjectInput,
	_ ...func(*s3.Options)) (*s3.PutObjectOutput,
	error) {
	return PutObjectSuccessful(), nil
}

func (*FileMoverS3Client) UploadPart(_ context.Context, _ *s3.UploadPartInput,
	_ ...func(*s3.Options)) (*s3.UploadPartOutput, error) {
	return UploadPartSuccessful(), nil
}

func (*FileMoverS3Client) CreateMultipartUpload(_ context.Context, _ *s3.CreateMultipartUploadInput,
	_ ...func(*s3.Options)) (*s3.CreateMultipartUploadOutput, error) {
	return CreateMultipartUploadSuccessful(), nil
}

func (*FileMoverS3Client) CompleteMultipartUpload(_ context.Context, _ *s3.CompleteMultipartUploadInput,
	_ ...func(*s3.Options)) (*s3.CompleteMultipartUploadOutput, error) {
	return CompleteMultipartUploadSuccessful(), nil
}

func (*FileMoverS3Client) AbortMultipartUpload(_ context.Context, _ *s3.AbortMultipartUploadInput,
	_ ...func(*s3.Options)) (*s3.AbortMultipartUploadOutput, error) {
	return AbortMultipartUploadSuccessful(), nil
}

func (*FileMoverS3Client) GetObject(_ context.Context, _ *s3.GetObjectInput, _ ...func(*s3.Options)) (*s3.GetObjectOutput,
	error) {
	return GetObjectSuccessful(), nil
}
