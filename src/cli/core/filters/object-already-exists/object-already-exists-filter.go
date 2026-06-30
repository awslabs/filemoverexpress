package object_already_exists

import (
	"errors"
	"fmt"
	"net/http"

	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"

	"github.com/awslabs/filemoverexpress/constants"
	transferapi "github.com/awslabs/filemoverexpress/core/transfer-api"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

type ObjectAlreadyExistsFilter struct {
	s3m              *transferapi.S3Manager
	filterType       s3_sharedv1.SkippedState
	checksumSettings configtypes.ChecksumSettings
}

func (*ObjectAlreadyExistsFilter) FilteredReason() string {
	return "Object already exists"
}

func (oaef *ObjectAlreadyExistsFilter) SkipType() s3_sharedv1.SkippedState {
	return oaef.filterType
}

func (oaef *ObjectAlreadyExistsFilter) IsFiltered(taskInput *jobmanagertypes.Task) (bool, error) {
	result, err := oaef.s3m.HeadObject(taskInput.Destination())
	if err != nil {
		var responseError *awshttp.ResponseError
		if errors.As(err, &responseError) && responseError.HTTPStatusCode() == http.StatusNotFound {
			return false, nil
		}
		return false, fmt.Errorf("failed to grab s3 object data for destination path %s: %w", taskInput.Destination(), err)
	}
	if oaef.checksumSettings.Enabled {
		return hasSizeMatch(taskInput, result) && hasChecksumMatch(result.Metadata, taskInput, oaef.checksumSettings.Algorithm), nil
	}
	return hasSizeMatch(taskInput, result) && lastModifiedCheck(taskInput, result), nil
}

func NewObjectAlreadyExistsFilter(s3m *transferapi.S3Manager, checksumSettings configtypes.ChecksumSettings) (*ObjectAlreadyExistsFilter,
	error) {
	return &ObjectAlreadyExistsFilter{
		s3m:              s3m,
		filterType:       s3_sharedv1.SkippedState_SKIPPED_STATE_ALREADY_EXISTS,
		checksumSettings: checksumSettings,
	}, nil
}

func hasSizeMatch(source *jobmanagertypes.Task, result *transferapi.FTHeadObjectOutput) bool {
	return source.GetSize() == result.ContentLength
}

func hasChecksumMatch(metadata map[string]string, source *jobmanagertypes.Task, alg constants.ChecksumAlgorithm) bool {
	switch alg {
	case constants.AlgorithmMD5:
		return hasMd5(metadata, source)
	case constants.AlgorithmXXHash:
		return hasXxhash(metadata, source)
	case constants.AlgorithmXXHash64:
		return hasXxhash64(metadata, source)
	case constants.AlgorithmXXH3:
		return hasXxh3(metadata, source)
	default:
		return false
	}
}

func hasMd5(metadata map[string]string, source *jobmanagertypes.Task) bool {
	md5, ok := metadata["md5-hex"]
	if ok && md5 != "" {
		return md5 == source.Checksum()
	}
	return false
}

func hasXxhash(metadata map[string]string, source *jobmanagertypes.Task) bool {
	xxhash, ok := metadata["xxhash"]
	if ok && xxhash != "" {
		return xxhash == source.Checksum()
	}
	return false
}

func hasXxhash64(metadata map[string]string, source *jobmanagertypes.Task) bool {
	xxhash64, ok := metadata["xxhash64"]
	if ok && xxhash64 != "" {
		return xxhash64 == source.Checksum()
	}
	return false
}

func hasXxh3(metadata map[string]string, source *jobmanagertypes.Task) bool {
	xxh3, ok := metadata["xxh3"]
	if ok && xxh3 != "" {
		return xxh3 == source.Checksum()
	}
	return false
}

func lastModifiedCheck(source *jobmanagertypes.Task, result *transferapi.FTHeadObjectOutput) bool {
	return !source.LocalFile().LastModified.After(*result.LastModified)
}
