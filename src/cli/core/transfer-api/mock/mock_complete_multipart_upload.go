package mock

import (
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go/middleware"
)

func CompleteMultipartUploadSuccessful() *s3.CompleteMultipartUploadOutput {
	versionId := "4PPmkB8eJAJBKEd9Ec_FxfsgPfAOhaBc"
	sseKmsKeyId := "arn:aws:kms:us-west-2:123456789123:key/0fe1a834-5736-11ee-8b64-acde48001122"
	location := "https://my-bucket.s3.us-west-2.amazonaws.com/1mb_file.txt"
	bucket := "my-bucket"
	key := "1mb_file.txt"
	eTag := "6737d92728f74afb23d284b307bf49bc-1"
	metadata := middleware.Metadata{}
	metadata.Set("RequestId", "6WCNH7V3YY1FREYE")
	metadata.Set("HostId", "hvcbT+SyFFYK5AwkVHBPZUfHZo7S4ngYSH2X3AbnQYjFM8n1Lf7vvWUo0v1xrN1mzCKtvyfQYsU=")
	metadata.Set("HTTPStatusCode", 200)
	metadata.Set("RetryAttempts", 0)

	return &s3.CompleteMultipartUploadOutput{
		Bucket:               &bucket,
		BucketKeyEnabled:     aws.Bool(false),
		ETag:                 &eTag,
		Key:                  &key,
		Location:             &location,
		SSEKMSKeyId:          &sseKmsKeyId,
		ServerSideEncryption: "aws:kms",
		VersionId:            &versionId,
		ResultMetadata:       metadata,
	}
}
