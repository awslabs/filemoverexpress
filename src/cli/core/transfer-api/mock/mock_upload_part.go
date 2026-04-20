package mock

import (
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go/middleware"
)

func UploadPartSuccessful() *s3.UploadPartOutput {
	eTag := "92b2f5e01ebb0753d16f711a687775c2"
	sseKmsKeyId := "arn:aws:kms:us-west-2:123456789123:key/0fe1a834-5736-11ee-8b64-acde48001122"
	metadata := middleware.Metadata{}
	return &s3.UploadPartOutput{
		BucketKeyEnabled:     aws.Bool(false),
		ETag:                 &eTag,
		SSEKMSKeyId:          &sseKmsKeyId,
		ServerSideEncryption: "aws:kms",
		ResultMetadata:       metadata,
	}
}
