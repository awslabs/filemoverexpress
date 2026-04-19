package transfer_api

import (
	"context"
	"errors"
	"fmt"
	"math"
	"path"
	"slices"
	"sort"
	"strings"
	"sync"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/events"
	ftErrors "github.com/awslabs/filemoverexpress/fme-errors"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/utils/safeconv"
)

const (
	atomicCopyObjectSizeLimit     = 2 * constants.GiB // 5GiB is the limit for SDK CopyObject(), but lowering it to speed up copy
	multipartCopyPartSize         = constants.DefaultChunkSize * constants.MiB
	numMultipartCopyWorkers       = 4
	strMultipartTransferCompleted = "multipart copy completed"
)

var copyObjectInvalidStorageClasses = []string{
	string(s3types.StorageClassGlacier),
	string(s3types.StorageClassDeepArchive),
}

type (
	S3ObjectRenameData struct {
		newName      string
		size         int64
		storageClass s3types.StorageClass
	}

	MultipartCopyInput struct {
		Bucket         string
		DestinationKey string
		CopySourceKey  string // is the copySource without the bucket name prepended
		CopySourceSize int64
		StorageClass   s3types.StorageClass
	}

	CopyPartInput struct {
		bucket             string
		copySourceKey      string
		copySource         string
		key                string
		partNumber         int32
		uploadId           string
		copySourceSize     int64
		copyCompletedParts chan *s3types.CompletedPart
		wg                 *sync.WaitGroup
		cancelCtx          context.Context
		cancelFunc         context.CancelCauseFunc
	}
)

func (s3m *S3Manager) RenameS3Object(oldObject string, newObject string) error {
	pathToRename := FormatAsS3Object(oldObject)
	newPathName := FormatAsS3Object(newObject)

	events.Events.Info("Started rename of %s to %s in bucket %s", pathToRename, newPathName, s3m.Bucket)

	// check empty paths
	if pathToRename == "" || pathToRename == "/" {
		events.Events.Error("Error renaming %s to new name %s: %s", pathToRename, newPathName,
			ftErrors.ErrRenameFromEmptyPath.Error())
		return ftErrors.ErrRenameFromEmptyPath
	}
	if newPathName == "" || newPathName == "/" {
		events.Events.Error("Error renaming %s to new name %s: %s", pathToRename, newPathName,
			ftErrors.ErrRenameToEmptyPath.Error())
		return ftErrors.ErrRenameToEmptyPath
	}

	// check new path name for existence
	headObject, _ := s3m.HeadObject(newPathName)
	if headObject != nil {
		events.Events.Error("Error renaming %s to new name %s: %s", pathToRename, newPathName,
			ftErrors.ErrRenameToExistingObject.Error())
		return fmt.Errorf("error renaming %s to new name %s: %w", pathToRename, newPathName, ftErrors.ErrRenameToExistingObject)
	}

	headObject, err := s3m.HeadObject(pathToRename)
	if err != nil {
		events.Events.Error("Error renaming %s to new name %s: %s", pathToRename, newPathName, ftErrors.ErrGettingObject.Error())
		return ftErrors.ErrGettingObject
	}
	// check storage class
	if slices.Contains(copyObjectInvalidStorageClasses, string(headObject.StorageClass)) {
		events.Events.Error("Error renaming %s to new name %s: %s", pathToRename, newPathName,
			ftErrors.ErrInvalidRenameStorageClassObject.Error())
		return fmt.Errorf("error renaming object %s because %w: %s", pathToRename, ftErrors.ErrInvalidRenameStorageClassObject,
			headObject.StorageClass)
	}

	objectNewNameData := S3ObjectRenameData{
		newName:      newPathName,
		size:         headObject.ContentLength,
		storageClass: headObject.StorageClass,
	}
	err = s3m.PerformSingleObjectRename(pathToRename, objectNewNameData)
	if err != nil {
		return err
	}
	events.Events.Info("Rename %s to %s in bucket %s completed", pathToRename, newPathName, s3m.Bucket)
	return nil
}

func (s3m *S3Manager) RenameS3Prefix(oldPrefix string, newPrefix string) error {
	pathToRename := FormatAsS3Prefix(oldPrefix)
	newPathName := FormatAsS3Prefix(newPrefix)

	events.Events.Info("Started rename of %s to %s in bucket %s", pathToRename, newPathName, s3m.Bucket)

	// check empty paths
	if pathToRename == "" || pathToRename == "/" {
		events.Events.Error("Error renaming %s to new prefix %s: %s", pathToRename, newPathName,
			ftErrors.ErrRenameFromEmptyPath.Error())
		return ftErrors.ErrRenameFromEmptyPath
	}
	if newPathName == "" || newPathName == "/" {
		events.Events.Error("Error renaming %s to new prefix %s: %s", pathToRename, newPathName,
			ftErrors.ErrRenameToEmptyPath.Error())
		return ftErrors.ErrRenameToEmptyPath
	}

	// check new prefix name for existence (has child prefixes/objects)
	prefixHasContent := s3m.CheckPrefixHasContent(newPathName, "/")
	if prefixHasContent {
		events.Events.Error("Error renaming %s to new prefix %s: %s", pathToRename, newPathName,
			ftErrors.ErrRenameToExistingPrefix.Error())
		return fmt.Errorf("error renaming %s to new prefix %s: %w", pathToRename, newPathName,
			ftErrors.ErrRenameToExistingPrefix)
	}

	// discover objects
	objectsToRename := make(map[string]S3ObjectRenameData)
	listObjectsOutput, err := s3m.ListObjects(pathToRename)
	if err != nil {
		return fmt.Errorf("%w: %s", ftErrors.ErrGettingObjectsInPrefix, err)
	}
	for _, object := range listObjectsOutput.S3Objects {
		// check storage class
		if slices.Contains(copyObjectInvalidStorageClasses, object.StorageClass) {
			events.Events.Error("Error renaming %s to new prefix %s: %s", pathToRename, newPathName,
				ftErrors.ErrInvalidRenameStorageClassPrefix.Error())
			return fmt.Errorf("error renaming prefix %s because %w: %s", pathToRename,
				ftErrors.ErrInvalidRenameStorageClassPrefix,
				object.StorageClass)
		}
		awsStorageClass, err := convertToAWSStorageClass(object.StorageClass)
		if err != nil {
			events.Events.Error("Error renaming object %s with storage class %s for rename: %s", object.Key, object.StorageClass,
				ftErrors.ErrConvertStorageClass.Error())
			return fmt.Errorf("error renaming object %s with storage class %s for rename: %w", object.Key, object.StorageClass,
				ftErrors.ErrConvertStorageClass)
		}

		objectsToRename[object.Key] = S3ObjectRenameData{
			newName:      path.Join(newPathName, strings.TrimPrefix(object.Key, pathToRename)),
			size:         object.Size,
			storageClass: awsStorageClass,
		}
	}

	// perform copy and deletes
	renameErrors := 0
	for objectOldName, objectNewNameData := range objectsToRename {
		err = s3m.PerformSingleObjectRename(objectOldName, objectNewNameData)
		if err != nil {
			renameErrors++
		}
	}

	if renameErrors > 0 {
		events.Events.Error("Rename %s to %s in bucket %s completed with %d error(s)", pathToRename, newPathName,
			s3m.Bucket, renameErrors)
		return fmt.Errorf("%d error(s) while renaming %s to %s in %s, %w", renameErrors,
			pathToRename, newPathName, s3m.Bucket, ftErrors.ErrRenameErrorsOccurred)
	}

	events.Events.Info("Rename %s to %s in bucket %s completed", pathToRename, newPathName, s3m.Bucket)
	return nil
}

func (s3m *S3Manager) PerformSingleObjectRename(objectOldName string, objectNewNameData S3ObjectRenameData) error {
	// copy object to new name
	copySource := path.Join(s3m.Bucket, objectOldName)
	if objectNewNameData.size < atomicCopyObjectSizeLimit {
		_, err := s3m.Client.CopyObject(context.TODO(), &s3.CopyObjectInput{
			Bucket:       &s3m.Bucket,
			CopySource:   &copySource,
			Key:          &objectNewNameData.newName,
			StorageClass: objectNewNameData.storageClass,
		})
		if err != nil {
			events.Events.Error("Error copying object %s to %s, keeping %s with original name: %s", objectOldName,
				objectNewNameData.newName, objectOldName, err)
			return err
		}
	} else {
		multiPartCopyInput := &MultipartCopyInput{
			Bucket:         s3m.Bucket,
			DestinationKey: objectNewNameData.newName,
			CopySourceKey:  objectOldName,
			CopySourceSize: objectNewNameData.size,
			StorageClass:   objectNewNameData.storageClass,
		}
		err := s3m.PerformMultipartCopy(multiPartCopyInput)
		if err != nil {
			events.Events.Error("Error copying object %s to %s, keeping %s with original name: %s", objectOldName,
				objectNewNameData.newName, objectOldName, err)
			return err
		}
	}
	logger.Info("Copied object %s to %s in bucket %s", objectOldName, objectNewNameData.newName, s3m.Bucket)
	// delete old object if copy succeeds
	err := s3m.DeleteObject(objectOldName)
	if err != nil {
		events.Events.Error("error deleting original object %s after copy: %s", objectOldName, err)
		return err
	}
	return nil
}

// revive:disable:function-length
// PerformMultipartCopy performs a multipart copy of an S3 object within a bucket
func (s3m *S3Manager) PerformMultipartCopy(multipartCopyInput *MultipartCopyInput) error {
	multipartUploadInput := s3.CreateMultipartUploadInput{
		Bucket: &multipartCopyInput.Bucket,
		Key:    &multipartCopyInput.DestinationKey,
	}
	multipartUploadOutput, err := s3m.Client.CreateMultipartUpload(context.TODO(), &multipartUploadInput)
	if err != nil {
		events.Events.Error("Error creating multipart upload to copy object %s to %s, keeping %s with original name: %s",
			multipartCopyInput.CopySourceKey, multipartCopyInput.DestinationKey, multipartCopyInput.CopySourceKey, err)
		return err
	}
	if multipartUploadOutput == nil || multipartUploadOutput.UploadId == nil || *multipartUploadOutput.UploadId == "" {
		events.Events.Error("Error creating multipart upload to copy object %s to %s, keeping %s with original name: %s",
			multipartCopyInput.CopySourceKey, multipartCopyInput.DestinationKey, multipartCopyInput.CopySourceKey, err)
		return err
	}

	uploadId := *multipartUploadOutput.UploadId
	numParts := calculateNumParts(multipartCopyInput.CopySourceSize)
	copySource := buildCopySourceString(multipartCopyInput.Bucket, multipartCopyInput.CopySourceKey)

	wg := &sync.WaitGroup{}
	workChannel := make(chan *CopyPartInput)
	resultsChannel := make(chan *s3types.CompletedPart, numParts)
	cancelChan := make(chan bool)
	ctx, cancelFunc := context.WithCancelCause(context.Background())
	defer cancelFunc(errors.New(strMultipartTransferCompleted))

	s3m.startMultipartCopyWorkers(workChannel, resultsChannel, cancelChan, wg)

	// AWS SDK UploadPartCopyInput PartNumber is 1-indexed
	for partNumber := int32(1); partNumber <= numParts; partNumber++ {
		wg.Add(1)
		copyPartInput := CopyPartInput{
			bucket:             multipartCopyInput.Bucket,
			copySourceKey:      multipartCopyInput.CopySourceKey,
			copySource:         copySource,
			key:                multipartCopyInput.DestinationKey,
			partNumber:         partNumber,
			uploadId:           uploadId,
			copySourceSize:     multipartCopyInput.CopySourceSize,
			copyCompletedParts: resultsChannel,
			wg:                 wg,
			cancelCtx:          ctx,
			cancelFunc:         cancelFunc,
		}

		workChannel <- &copyPartInput
	}

	wg.Wait()

	cancelChan <- true
	close(resultsChannel)
	var completedParts []s3types.CompletedPart
	for part := range resultsChannel {
		completedParts = append(completedParts, *part)
	}

	// abort multipart copy if any part failed
	completedPartCount, err := safeconv.IntToInt32(len(completedParts))
	if err != nil {
		return err
	}

	if completedPartCount < numParts {
		_, err = s3m.Client.AbortMultipartUpload(context.TODO(), &s3.AbortMultipartUploadInput{
			Bucket:   &multipartCopyInput.Bucket,
			Key:      &multipartCopyInput.DestinationKey,
			UploadId: &uploadId,
		})
		if err != nil {
			events.Events.Error("Error aborting multipart upload to copy object %s to %s: %s", multipartCopyInput.CopySourceKey,
				multipartCopyInput.DestinationKey, err)
		}
		return fmt.Errorf("%w %s to %s, check logs for specific errors", ftErrors.ErrMultipartCopyIncomplete,
			multipartCopyInput.CopySourceKey,
			multipartCopyInput.DestinationKey)
	}

	//complete actual multipart copy
	sort.SliceStable(completedParts, func(i, j int) bool {
		return *completedParts[i].PartNumber < *completedParts[j].PartNumber
	})
	multipartUpload := s3types.CompletedMultipartUpload{
		Parts: completedParts,
	}
	completeInput := s3.CompleteMultipartUploadInput{
		Bucket:          &multipartCopyInput.Bucket,
		Key:             &multipartCopyInput.DestinationKey,
		UploadId:        &uploadId,
		MultipartUpload: &multipartUpload,
	}
	_, err = s3m.Client.CompleteMultipartUpload(context.TODO(), &completeInput)
	if err != nil {
		return fmt.Errorf("%w %s to %s: %s", ftErrors.ErrCompletingMultipartCopy, multipartCopyInput.CopySourceKey,
			multipartCopyInput.DestinationKey, err)
	}
	return nil
}

// revive:enable:function-length

func (s3m *S3Manager) startMultipartCopyWorkers(workChan chan *CopyPartInput, resultsChan chan *s3types.CompletedPart,
	cancelChan chan bool, wg *sync.WaitGroup) {
	for i := 0; i < numMultipartCopyWorkers; i++ {
		go s3m.multipartCopyWorker(workChan, resultsChan, cancelChan, wg)
	}
}

func (s3m *S3Manager) multipartCopyWorker(workChan chan *CopyPartInput, resultsChan chan *s3types.CompletedPart,
	cancelChan chan bool, wg *sync.WaitGroup) {
	for {
		select {
		case <-cancelChan:
			// stop the worker after all work is done
			return
		case request := <-workChan:
			// abort upload if another part failed
			if request.cancelCtx.Err() != nil {
				wg.Done()
				return
			}
			// perform part upload
			uploadPartCopyOutput, err := s3m.copyPart(request)
			if err != nil {
				request.cancelFunc(err)
				events.Events.Error("Error copying part of object %s to %s, keeping %s with original name: %s",
					request.copySourceKey, request.key, request.copySourceKey, err)
			} else {
				resultsChan <- &s3types.CompletedPart{
					PartNumber: &request.partNumber,
					ETag:       uploadPartCopyOutput.CopyPartResult.ETag,
				}
			}
			wg.Done()
		}
	}
}

func (s3m *S3Manager) copyPart(copyPartInput *CopyPartInput) (*s3.UploadPartCopyOutput, error) {
	copySourceRange := buildCopySourceRangeString(copyPartInput.partNumber, copyPartInput.copySourceSize)
	return s3m.Client.UploadPartCopy(context.TODO(), &s3.UploadPartCopyInput{
		Bucket:          &copyPartInput.bucket,
		CopySource:      &copyPartInput.copySource,
		Key:             &copyPartInput.key,
		PartNumber:      &copyPartInput.partNumber,
		UploadId:        &copyPartInput.uploadId,
		CopySourceRange: &copySourceRange,
	})
}

func buildCopySourceString(bucket string, copySourceKey string) string {
	return strings.Join([]string{bucket, copySourceKey}, "/")
}

func calculateNumParts(size int64) int32 {
	numParts := math.Ceil(float64(size) / float64(multipartCopyPartSize))

	// Safe conversion for multipart copy parts count - Issue #14
	parts, err := safeconv.Float64ToInt32(numParts)
	if err != nil {
		logger.Error("Invalid multipart copy parts count %f for size %d: %v, using 1", numParts, size, err)
		return 1 // Default to single part if conversion fails
	}
	return parts
}

func buildCopySourceRangeString(partNumber int32, totalSize int64) string {
	partNumberInt64 := int64(partNumber)
	// AWS SDK UploadPartInput PartNumber is 1-indexed, CopySourceRange bytes range is 0-indexed
	start := (partNumberInt64 - 1) * multipartCopyPartSize
	endInclusive := min(partNumberInt64*multipartCopyPartSize-1, totalSize-1)
	return fmt.Sprintf("bytes=%d-%d", start, endInclusive)
}
