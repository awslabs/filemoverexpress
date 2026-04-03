package mock

import (
    "github.com/aws/aws-sdk-go-v2/aws"
    "github.com/aws/aws-sdk-go-v2/service/s3"
    "github.com/aws/smithy-go/middleware"
)

func CreateMultipartUploadSuccessful() *s3.CreateMultipartUploadOutput {
    sseKmsKeyId := "arn:aws:kms:us-west-2:123456789123:key/0fe1a834-5736-11ee-8b64-acde48001122"
    bucket := "my-bucket"
    key := "1mb_file.txt"
    uploadId := "IIMkGHoXCaPZPeb3Vc.iKdtVR6Ou4JosiWl_PhY.4qms.7Dp83gX.bbg0yEvWbvvVBRcHbGduXqlB4qf0hlasqxDUiml." +
        "JVWUNzpmZljGsRTACg1yrL80jcuZBopmc2IGcOWxtXDk2JYksh7Gr9QPQ--"
    metadata := middleware.Metadata{}
    metadata.Set("RequestId", "BH3D1FA3H2FNPWYT")
    metadata.Set("HostId", "dlhsPtqtvRSgLtLcJ+svi7qDqJAZfH6UtlFWhYMq25ExK9jTuVOgP1dWZgi0np6dcHL0o7A+hUw=")
    metadata.Set("HTTPStatusCode", 200)
    metadata.Set("RetryAttempts", 1)

    return &s3.CreateMultipartUploadOutput{
        Bucket:               &bucket,
        BucketKeyEnabled:     aws.Bool(false),
        ChecksumAlgorithm:    "",
        Key:                  &key,
        RequestCharged:       "",
        SSEKMSKeyId:          &sseKmsKeyId,
        ServerSideEncryption: "aws:kms",
        UploadId:             &uploadId,
        ResultMetadata:       metadata,
    }
}
