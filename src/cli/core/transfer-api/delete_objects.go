package transfer_api

import (
	"context"
	"fmt"
	"math"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"

	"github.com/awslabs/filemoverexpress/events"
	fterrors "github.com/awslabs/filemoverexpress/fme-errors"
	"github.com/awslabs/filemoverexpress/logger"
)

const (
	MaxObjectsPerDeleteObjectsCall = 1000 // defined by AWS SDK DeleteObjects()
)

func (s3m *S3Manager) DeleteObject(objectPrefix string) error {
	cleanedObjectPrefix := FormatAsS3Object(objectPrefix)
	events.Events.Info("Started deletion of %s from bucket %s", cleanedObjectPrefix, s3m.Bucket)

	// check if path is empty
	versionsOutput, err := s3m.ListVersionsForObject(objectPrefix)
	if err != nil {
		events.Events.Error("%s: %s", fterrors.ErrGetObjectVersions.Error(), err.Error())
		return fmt.Errorf("%w: %w", fterrors.ErrGetObjectVersions, err)
	}
	if len(versionsOutput.S3ObjectVersions) == 0 {
		events.Events.Error("Error deleting %s from bucket %s: %s", objectPrefix, s3m.Bucket,
			fterrors.ErrNoObjectVersionsToDelete.Error())
		return fmt.Errorf("error deleting %s: %w", objectPrefix, fterrors.ErrNoObjectVersionsToDelete)
	}

	return s3m.deleteVersions(versionsOutput.S3ObjectVersions, objectPrefix)
}

func (s3m *S3Manager) DeletePrefix(prefixToDelete string) error {
	cleanedPrefixToDelete := FormatAsS3Prefix(prefixToDelete)
	events.Events.Info("Started deletion of %s from bucket %s", cleanedPrefixToDelete, s3m.Bucket)

	// check if path is empty
	if cleanedPrefixToDelete == "" || cleanedPrefixToDelete == "/" {
		events.Events.Error("Error deleting %s from bucket %s: %s", cleanedPrefixToDelete, s3m.Bucket,
			fterrors.ErrDeleteEmptyPath.Error())
		return fterrors.ErrDeleteEmptyPath
	}

	// discover versions
	versionsOutput, err := s3m.ListVersionsInPrefix(cleanedPrefixToDelete)
	if err != nil {
		events.Events.Error("%s: %s", fterrors.ErrGetObjectVersions.Error(), err.Error())
		return fmt.Errorf("%w: %w", fterrors.ErrGetObjectVersions, err)
	}
	if len(versionsOutput.S3ObjectVersions) == 0 {
		events.Events.Error("Error deleting %s from bucket %s: %s", cleanedPrefixToDelete, s3m.Bucket,
			fterrors.ErrNoObjectVersionsToDelete.Error())
		return fmt.Errorf("error deleting %s: %w", cleanedPrefixToDelete, fterrors.ErrNoObjectVersionsToDelete)
	}

	return s3m.deleteVersions(versionsOutput.S3ObjectVersions, cleanedPrefixToDelete)
}

func (s3m *S3Manager) deleteVersions(versionsToDelete []S3ObjectVersion, pathToDelete string) error {
	// call DeleteObjects on discovered objects MaxObjectsPerDeleteObjectsCall at a time
	numDeleteObjectsCommands := int(math.Ceil(float64(len(versionsToDelete)) / float64(MaxObjectsPerDeleteObjectsCall)))
	numDeleteErrors := 0
	for i := 0; i < numDeleteObjectsCommands; i++ {
		start := i * MaxObjectsPerDeleteObjectsCall
		endInclusive := min(start+MaxObjectsPerDeleteObjectsCall, len(versionsToDelete)) - 1
		numObjects := endInclusive - start + 1

		objectIdentifiers := make([]types.ObjectIdentifier, numObjects)
		for j := start; j <= endInclusive; j++ {
			objectIdentifiers[j-start] = types.ObjectIdentifier{
				Key:       &versionsToDelete[j].Key,
				VersionId: &versionsToDelete[j].VersionId,
			}
		}
		deleteInput := &types.Delete{
			Objects: objectIdentifiers,
		}
		deleteObjectsInput := &s3.DeleteObjectsInput{
			Bucket: &s3m.Bucket,
			Delete: deleteInput,
		}
		deleteObjectsOutput, err := s3m.Client.DeleteObjects(context.TODO(), deleteObjectsInput)
		if deleteObjectsOutput != nil {
			for _, success := range deleteObjectsOutput.Deleted {
				logger.Info("Successfully deleted %s version %s from bucket %s", *success.Key, *success.VersionId,
					s3m.Bucket)
			}
			for _, failure := range deleteObjectsOutput.Errors {
				numDeleteErrors++
				events.Events.Error("Error deleting %s version %s from bucket %s: %s", *failure.Key, *failure.VersionId,
					s3m.Bucket, *failure.Message)
			}
		}
		if err != nil {
			return err
		}
	}

	if numDeleteErrors > 0 {
		events.Events.Error("%d error(s) while deleting %s from bucket %s: %s", numDeleteErrors,
			pathToDelete, s3m.Bucket, fterrors.ErrDeleteErrorsOccurred.Error())
		return fmt.Errorf("%d error(s) while deleting %s from bucket %s: %w", numDeleteErrors,
			pathToDelete, s3m.Bucket, fterrors.ErrDeleteErrorsOccurred)
	}

	events.Events.Info("Successfully completed deletion of %s from bucket %s", pathToDelete, s3m.Bucket)
	return nil
}
