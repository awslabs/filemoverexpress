package mock

import (
    "github.com/aws/aws-sdk-go-v2/service/s3"
    "github.com/aws/smithy-go/middleware"
)

func AbortMultipartUploadSuccessful() *s3.AbortMultipartUploadOutput {
    metadata := middleware.Metadata{}
    metadata.Set("RequestId", "QGRV31B37K3ZS2N1")
    metadata.Set("HostId", "NY82NoBbD/zoJiM3KYKG+3/363BLh0VMaZxB3seVMJ9RckS0DbH984B5yEfhP96HIKstFCATMbk=")
    metadata.Set("HTTPStatusCode", 204)
    metadata.Set("RetryAttempts", 0)

    return &s3.AbortMultipartUploadOutput{
        ResultMetadata: metadata,
    }
}
