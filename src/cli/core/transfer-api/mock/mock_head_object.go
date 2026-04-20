package mock

import (
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go/middleware"
)

func HeadObjectSuccessful() *s3.HeadObjectOutput {
	acceptRanges := "bytes"
	contentType := "binary/octet-stream"
	eTag := "dbfccf4fa6adbb518de3295d2bc932ab"
	lastModified, _ := time.Parse(time.RFC3339, UnitTestLastModifiedForPrefix)
	sseKmsKeyId := "arn:aws:kms:us-west-2:123456789123:key/0fe1a834-5736-11ee-8b64-acde48001122"
	versionId := "uXfEJEYyZr5.SYGIOto77b0jYGFCb31_"
	metadata := make(map[string]string)
	metadata["md5-hex"] = "d8d4c2d1c8e4b04d96bca23175d071c5"
	metadata["xxh3"] = ""
	metadata["xxhash"] = ""
	metadata["xxhash64"] = ""
	responseMetadata := middleware.Metadata{}
	responseMetadata.Set("RequestId", "C8J6HJ39V6PDQC6T")
	responseMetadata.Set("HostId", "N3zHFSU+qJOtuiNlUJ4KC3GLADlTKlsMaeYjlOzvOMWsz45UB6itSqF5ZVFRakLKoo88Aw8E5zk0NAX/Ng9ggg==")
	responseMetadata.Set("HTTPStatusCode", 200)
	responseMetadata.Set("RetryAttempts", 0)

	return &s3.HeadObjectOutput{
		AcceptRanges:              &acceptRanges,
		ArchiveStatus:             "",
		BucketKeyEnabled:          aws.Bool(false),
		ContentLength:             aws.Int64(1048576),
		ContentType:               &contentType,
		DeleteMarker:              aws.Bool(false),
		ETag:                      &eTag,
		LastModified:              &lastModified,
		Metadata:                  metadata,
		ObjectLockRetainUntilDate: &time.Time{},
		SSEKMSKeyId:               &sseKmsKeyId,
		ServerSideEncryption:      "aws:kms",
		VersionId:                 &versionId,
		ResultMetadata:            responseMetadata,
	}
}
