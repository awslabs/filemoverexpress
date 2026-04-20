package mock

import "github.com/aws/aws-sdk-go-v2/service/s3"

func deleteObjectSuccessful() *s3.DeleteObjectOutput {
	return &s3.DeleteObjectOutput{}
}
