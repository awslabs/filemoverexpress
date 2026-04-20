package mock

import (
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go/middleware"
)

func ListObjectsV2Successful() *s3.ListObjectsV2Output {
	bucket := UnitTestMockBucket
	prefix := UnitTestFolderPrefix

	key1 := UnitTestFolderPrefix
	lastModified1, _ := time.Parse(time.RFC3339, UnitTestLastModifiedForPrefix)
	eTag1 := UnitTestETagForPrefix

	key2 := UnitTestFileNameWithPrefix
	lastModified2, _ := time.Parse(time.RFC3339, UnitTestLastModifiedForFilePathWithPrefix)
	eTag2 := UnitTestETagForFilePathWithPrefix

	folder1 := UnitTestFolderPrefix + "folder1/"
	folder2 := UnitTestFolderPrefix + "folder2/"

	contents := []types.Object{
		{
			Key:          &key1,
			LastModified: &lastModified1,
			ETag:         &eTag1,
			Size:         aws.Int64(0),
			StorageClass: types.ObjectStorageClassStandard,
		},
		{
			Key:          &key2,
			LastModified: &lastModified2,
			ETag:         &eTag2,
			Size:         aws.Int64(1048576),
			StorageClass: types.ObjectStorageClassStandard,
		},
	}
	commonPrefixes := []types.CommonPrefix{
		{
			Prefix: &folder1,
		},
		{
			Prefix: &folder2,
		},
	}
	metadata := middleware.Metadata{}
	metadata.Set("RequestId", "FWK52VV0G0WVAZGP")
	metadata.Set("HostId", "MIKWCSZHxWcvwjvu+qwfFyxLcccASh/0zAFoA6AuGTr8KvW8YI23Rw51CKwc8G9ZpZptNbJUClJync1nQ4Ryog==")
	metadata.Set("HTTPStatusCode", 200)
	metadata.Set("RetryAttempts", 0)
	return &s3.ListObjectsV2Output{
		Contents:       contents,
		CommonPrefixes: commonPrefixes,
		EncodingType:   "url",
		IsTruncated:    aws.Bool(false),
		KeyCount:       aws.Int32(2),
		MaxKeys:        aws.Int32(1000),
		Name:           &bucket,
		Prefix:         &prefix,
		ResultMetadata: metadata,
	}
}
