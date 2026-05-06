package transfer_api

import (
	"context"
	"sync"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// renameCapturingClient implements FileMoverS3ClientInterface for rename tests. It
// records the CopyObject sources/destinations, the keys looked up for version
// deletion, and the keys deleted, so the test can assert that folder-marker keys
// (ending in "/") keep their trailing slash throughout a prefix rename (issue #22).
//
// Only the methods exercised by RenameS3Prefix are implemented; the embedded
// interface is nil, so any unexpected call will panic and surface as a test failure.
type renameCapturingClient struct {
	FileMoverS3ClientInterface

	objects           []s3types.Object
	copySources       []string
	copyDestKeys      []string
	listedVersionKeys []string
	deletedKeys       []string
}

func (c *renameCapturingClient) ListObjectsV2(_ context.Context, params *s3.ListObjectsV2Input,
	_ ...func(*s3.Options)) (*s3.ListObjectsV2Output, error) {
	// A delimiter is only set by CheckPrefixHasContent (the existence check on the
	// destination prefix); return empty so the destination looks unused.
	if params.Delimiter != nil {
		return &s3.ListObjectsV2Output{IsTruncated: aws.Bool(false)}, nil
	}
	return &s3.ListObjectsV2Output{Contents: c.objects, IsTruncated: aws.Bool(false)}, nil
}

func (c *renameCapturingClient) CopyObject(_ context.Context, params *s3.CopyObjectInput,
	_ ...func(*s3.Options)) (*s3.CopyObjectOutput, error) {
	c.copySources = append(c.copySources, aws.ToString(params.CopySource))
	c.copyDestKeys = append(c.copyDestKeys, aws.ToString(params.Key))
	return &s3.CopyObjectOutput{}, nil
}

func (c *renameCapturingClient) ListObjectVersions(_ context.Context, params *s3.ListObjectVersionsInput,
	_ ...func(*s3.Options)) (*s3.ListObjectVersionsOutput, error) {
	key := aws.ToString(params.Prefix)
	c.listedVersionKeys = append(c.listedVersionKeys, key)
	// Return a single latest version whose key matches the requested prefix exactly,
	// mirroring how a real object (or folder marker) would be reported.
	return &s3.ListObjectVersionsOutput{
		Versions: []s3types.ObjectVersion{
			{
				Key:       aws.String(key),
				VersionId: aws.String("v1"),
				Size:      aws.Int64(0),
				IsLatest:  aws.Bool(true),
			},
		},
	}, nil
}

func (c *renameCapturingClient) DeleteObjects(_ context.Context, params *s3.DeleteObjectsInput,
	_ ...func(*s3.Options)) (*s3.DeleteObjectsOutput, error) {
	deleted := make([]s3types.DeletedObject, 0, len(params.Delete.Objects))
	for _, obj := range params.Delete.Objects {
		c.deletedKeys = append(c.deletedKeys, aws.ToString(obj.Key))
		deleted = append(deleted, s3types.DeletedObject{
			Key:       obj.Key,
			VersionId: obj.VersionId,
		})
	}
	return &s3.DeleteObjectsOutput{Deleted: deleted}, nil
}

// TestRenameS3Prefix_PreservesFolderMarkerTrailingSlash guards issue #22: renaming a
// prefix that contains a folder-marker object (a zero-byte key ending in "/") must
// keep the trailing slash on the copy source, the copy destination, and the version
// lookup used for deletion. Previously path.Join / FormatAsS3Object stripped the slash,
// so the marker copy targeted a non-existent key and the marker delete found nothing,
// failing the whole prefix rename while single-object renames worked.
func TestRenameS3Prefix_PreservesFolderMarkerTrailingSlash(t *testing.T) {
	client := &renameCapturingClient{
		objects: []s3types.Object{
			{
				Key:          aws.String("parent/oldfolder/"),
				Size:         aws.Int64(0),
				StorageClass: s3types.ObjectStorageClassStandard,
			},
			{
				Key:          aws.String("parent/oldfolder/file.txt"),
				Size:         aws.Int64(100),
				StorageClass: s3types.ObjectStorageClassStandard,
			},
		},
	}
	s3m := &S3Manager{
		Bucket: "test-bucket",
		Client: client,
		Lock:   &sync.RWMutex{},
	}

	if err := s3m.RenameS3Prefix("parent/oldfolder/", "parent/newfolder/"); err != nil {
		t.Fatalf("RenameS3Prefix returned an unexpected error: %v", err)
	}

	assertContains(t, "copy source", client.copySources, "test-bucket/parent/oldfolder/")
	assertContains(t, "copy destination", client.copyDestKeys, "parent/newfolder/")
	assertContains(t, "version lookup key", client.listedVersionKeys, "parent/oldfolder/")
	assertContains(t, "deleted key", client.deletedKeys, "parent/oldfolder/")

	// The regular file inside the prefix must also be moved to the new prefix.
	assertContains(t, "copy source", client.copySources, "test-bucket/parent/oldfolder/file.txt")
	assertContains(t, "copy destination", client.copyDestKeys, "parent/newfolder/file.txt")
}

func assertContains(t *testing.T, label string, haystack []string, needle string) {
	t.Helper()
	for _, item := range haystack {
		if item == needle {
			return
		}
	}
	t.Errorf("expected %s %q to be present, got %v", label, needle, haystack)
}
