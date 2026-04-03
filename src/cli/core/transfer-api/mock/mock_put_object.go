package mock

import (
    "github.com/aws/aws-sdk-go-v2/aws"
    "github.com/aws/aws-sdk-go-v2/service/s3"
    "github.com/aws/smithy-go/middleware"
)

func PutObjectSuccessful() *s3.PutObjectOutput {
    eTag := "f0f0b9c995a670c70e50855cdfdfa228"
    versionId := "3GpyxIfXl9O7dRYwT99C9RqmNr2DJabc"
    sseKmsKeyId := "arn:aws:kms:us-west-2:123456789123:key/0fe1a834-5736-11ee-8b64-acde48001122"
    metadata := middleware.Metadata{}
    metadata.Set("RequestId", "P6MBR6VYC9J2Q93D")
    metadata.Set("HostId", "BM/WM7ubt6uVOOJ4FrAanCY2SP/B6HK/0ln6g+nr5D8+xV/Fj50c2zknElCG3E9Yl7876kc6X/8=")
    metadata.Set("HTTPStatusCode", 200)
    metadata.Set("RetryAttempts", 0)
    return &s3.PutObjectOutput{
        BucketKeyEnabled:     aws.Bool(false),
        ETag:                 &eTag,
        SSEKMSKeyId:          &sseKmsKeyId,
        ServerSideEncryption: "aws:kms",
        VersionId:            &versionId,
        ResultMetadata:       metadata,
    }
}
