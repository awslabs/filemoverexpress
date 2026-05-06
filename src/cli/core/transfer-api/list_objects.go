package transfer_api

import (
	"context"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/awslabs/filemoverexpress/logger"
)

type (
	ListObjectsOutput struct {
		S3Objects []S3Object
	}
	ListObjectsAndFolderOutput struct {
		S3Objects []S3Object
		S3Folders []string
	}
	ListObjectVersionsOutput struct {
		S3ObjectVersions []S3ObjectVersion
	}
	S3Object struct {
		Key          string
		LastModified *time.Time
		Metadata     map[string]string
		Size         int64
		StorageClass string
		VersionId    string
	}
	S3ObjectVersion struct {
		Key            string
		LastModified   *time.Time
		Size           int64
		VersionId      string
		IsLatest       bool
		IsDeleteMarker bool
	}
)

// CheckPrefixHasContent returns true if the prefix has child objects or common prefixes (prefix "exists")
func (s3m *S3Manager) CheckPrefixHasContent(prefix string, delimiter string) bool {
	params := &s3.ListObjectsV2Input{
		Bucket:    &s3m.Bucket,
		Prefix:    &prefix,
		Delimiter: &delimiter,
	}

	paginator := s3.NewListObjectsV2Paginator(s3m.Client, params)

	if paginator.HasMorePages() {
		s3Output, paginationErr := paginator.NextPage(context.TODO())
		if paginationErr != nil {
			return false
		}
		if s3Output != nil {
			return len(s3Output.Contents) > 0 || len(s3Output.CommonPrefixes) > 0
		}
	}
	return false
}

func (s3m *S3Manager) ListObjectsAndFolders(prefix string, delimiter string) (ListObjectsAndFolderOutput, error) {
	var output ListObjectsAndFolderOutput
	params := &s3.ListObjectsV2Input{
		Bucket:    &s3m.Bucket,
		Prefix:    &prefix,
		Delimiter: &delimiter,
	}

	paginator := s3.NewListObjectsV2Paginator(s3m.Client, params)
	for paginator.HasMorePages() {
		s3Output, paginationErr := paginator.NextPage(context.TODO())
		if paginationErr != nil {
			return output, paginationErr
		}
		for _, object := range s3Output.Contents {
			// don't add the object if it has the same path as the enclosing folder to avoid listing 0 bytes "/" objects
			if prefix != *object.Key {
				s3Object := S3Object{
					Key:          *object.Key,
					LastModified: object.LastModified,
					Metadata:     nil,
					Size:         *object.Size,
					StorageClass: string(object.StorageClass),
				}
				output.S3Objects = append(output.S3Objects, s3Object)
			}
		}
		for _, folder := range s3Output.CommonPrefixes {
			output.S3Folders = append(output.S3Folders, *folder.Prefix)
		}
	}
	return output, nil
}

func (s3m *S3Manager) ListObjects(prefix string) (ListObjectsOutput, error) {
	var output ListObjectsOutput

	params := &s3.ListObjectsV2Input{
		Bucket: &s3m.Bucket,
		Prefix: &prefix,
	}

	paginator := s3.NewListObjectsV2Paginator(s3m.Client, params)
	for paginator.HasMorePages() {
		s3Output, paginationErr := paginator.NextPage(context.TODO())
		if paginationErr != nil {
			return output, paginationErr
		}
		for _, object := range s3Output.Contents {
			s3Object := S3Object{
				Key:          *object.Key,
				LastModified: object.LastModified,
				Metadata:     nil,
				Size:         *object.Size,
				StorageClass: string(object.StorageClass),
			}
			output.S3Objects = append(output.S3Objects, s3Object)
		}
	}

	return output, nil
}

func (s3m *S3Manager) ListObjectsWithMetadata(prefix string) (ListObjectsOutput, error) {
	output, err := s3m.ListObjects(prefix)
	if err != nil {
		return output, err
	}

	for idx, object := range output.S3Objects {
		output.S3Objects[idx].Metadata, err = s3m.GetMetadata(object.Key)
		if err != nil {
			return output, err
		}
	}
	return output, nil
}

func (s3m *S3Manager) ListVersionsInPrefix(prefix string) (ListObjectVersionsOutput, error) {
	var listOutput ListObjectVersionsOutput
	inputPrefix := FormatAsS3Prefix(prefix)

	listObjectVersionsInput := &s3.ListObjectVersionsInput{
		Bucket: &s3m.Bucket,
		Prefix: &inputPrefix,
	}

	numObjectVersions := 0
	numLatestObjectVersions := 0
	numDeleteMarkers := 0
	paginator := s3.NewListObjectVersionsPaginator(s3m.Client, listObjectVersionsInput)
	for paginator.HasMorePages() {
		s3Output, paginationErr := paginator.NextPage(context.TODO())
		if paginationErr != nil {
			return listOutput, paginationErr
		}
		for _, version := range s3Output.Versions {
			objectVersion := S3ObjectVersion{
				Key:            *version.Key,
				LastModified:   version.LastModified,
				Size:           *version.Size,
				VersionId:      *version.VersionId,
				IsLatest:       *version.IsLatest,
				IsDeleteMarker: false,
			}
			if *version.IsLatest {
				numLatestObjectVersions++
			}
			numObjectVersions++
			listOutput.S3ObjectVersions = append(listOutput.S3ObjectVersions, objectVersion)
		}
		for _, version := range s3Output.DeleteMarkers {
			deleteMarker := S3ObjectVersion{
				Key:            *version.Key,
				LastModified:   version.LastModified,
				VersionId:      *version.VersionId,
				IsLatest:       *version.IsLatest,
				IsDeleteMarker: true,
			}
			numDeleteMarkers++
			listOutput.S3ObjectVersions = append(listOutput.S3ObjectVersions, deleteMarker)
		}
	}

	logger.Info("Found %d latest object version(s) out of %d total object version(s) and %d delete marker(s) in %s",
		numLatestObjectVersions, numObjectVersions, numDeleteMarkers, inputPrefix)

	return listOutput, nil
}

func (s3m *S3Manager) ListVersionsForObject(objKey string) (ListObjectVersionsOutput, error) {
	var listOutput ListObjectVersionsOutput
	// Strip only a leading slash and preserve any trailing slash, so folder-marker
	// objects (keys ending in "/") can be looked up by their exact key. FormatAsS3Object
	// would strip the trailing slash and the exact-key match below would never hit,
	// which broke deleting the marker during a prefix rename. See issue #22.
	inputPrefix := strings.TrimPrefix(objKey, "/")

	listObjectVersionsInput := &s3.ListObjectVersionsInput{
		Bucket: &s3m.Bucket,
		Prefix: &inputPrefix,
	}

	numObjectVersions := 0
	numLatestObjectVersions := 0
	numDeleteMarkers := 0
	paginator := s3.NewListObjectVersionsPaginator(s3m.Client, listObjectVersionsInput)
	for paginator.HasMorePages() {
		s3Output, paginationErr := paginator.NextPage(context.TODO())
		if paginationErr != nil {
			return listOutput, paginationErr
		}
		for _, version := range s3Output.Versions {
			if *version.Key == inputPrefix {
				objectVersion := S3ObjectVersion{
					Key:            *version.Key,
					LastModified:   version.LastModified,
					Size:           *version.Size,
					VersionId:      *version.VersionId,
					IsLatest:       *version.IsLatest,
					IsDeleteMarker: false,
				}
				if *version.IsLatest {
					numLatestObjectVersions++
				}
				numObjectVersions++
				listOutput.S3ObjectVersions = append(listOutput.S3ObjectVersions, objectVersion)
			}
		}
		for _, version := range s3Output.DeleteMarkers {
			if *version.Key == inputPrefix {
				deleteMarker := S3ObjectVersion{
					Key:            *version.Key,
					LastModified:   version.LastModified,
					VersionId:      *version.VersionId,
					IsLatest:       *version.IsLatest,
					IsDeleteMarker: true,
				}
				numDeleteMarkers++
				listOutput.S3ObjectVersions = append(listOutput.S3ObjectVersions, deleteMarker)
			}
		}
	}

	logger.Info("Found %d latest object version(s) out of %d total object version(s) and %d delete marker(s) for key %s",
		numLatestObjectVersions, numObjectVersions, numDeleteMarkers, inputPrefix)

	return listOutput, nil
}
