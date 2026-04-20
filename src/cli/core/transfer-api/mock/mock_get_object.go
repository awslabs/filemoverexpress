package mock

import (
	"io"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go/middleware"
)

func GetObjectSuccessful() *s3.GetObjectOutput {
	acceptRanges := "bytes"
	contentType := "binary/octet-stream"
	eTag := "6737d92728f74afb23d284b307bf49bc-1"
	lastModified, _ := time.Parse(time.RFC3339, "2023-09-12T05:10:07Z")
	sseKmsKeyId := "arn:aws:kms:us-west-2:123456789123:key/0fe1a834-5736-11ee-8b64-acde48001122"
	versionId := "4PPmkB8eJAJBKEd9Ec_FxfsgPfAOhaBc"
	metadata := make(map[string]string)
	bodyValue := "Body of Test Object"
	contentLength := int64(len(bodyValue))
	metadata["xxhash64"] = ""
	metadata["xxh3"] = ""
	metadata["md5-hex"] = "d8d4c2d1c8e4b04d96bca23175d071c5"
	metadata["xxhash"] = ""

	resultMetadata := middleware.Metadata{}
	resultMetadata.Set("RequestId", "BGTQCMVB8J19974G")
	resultMetadata.Set("HostId", "9JE67qYggPJUElCYVlFV6361wCilLaeFtUZRbw0CvZn6Yxq+NZQ2YNMHOAjQrcS8lfl1Z5FlcKfoCf5AiIa3Lg==")
	resultMetadata.Set("HTTPStatusCode", 200)
	resultMetadata.Set("RetryAttempts", 0)

	return &s3.GetObjectOutput{
		AcceptRanges:         &acceptRanges,
		Body:                 io.NopCloser(strings.NewReader(bodyValue)),
		BucketKeyEnabled:     aws.Bool(false),
		ContentLength:        &contentLength,
		ContentType:          &contentType,
		DeleteMarker:         aws.Bool(false),
		ETag:                 &eTag,
		LastModified:         &lastModified,
		Metadata:             metadata,
		SSEKMSKeyId:          &sseKmsKeyId,
		ServerSideEncryption: "aws:kms",
		VersionId:            &versionId,
		ResultMetadata:       resultMetadata,
	}
}
