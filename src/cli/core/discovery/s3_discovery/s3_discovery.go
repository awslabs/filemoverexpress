package s3_discovery

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/aws/aws-sdk-go-v2/service/s3/types"

	"github.com/awslabs/filemoverexpress/core/discovery"
	transferapi "github.com/awslabs/filemoverexpress/core/transfer-api"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

const sep = string(filepath.Separator)

var InvalidS3KeyStrings = []string{
	strings.Join([]string{sep, "..", sep}, ""),
	strings.Join([]string{sep, ".."}, ""),
	strings.Join([]string{"..", sep}, ""),
}

type (
	S3Discovery struct {
		destinationFolder string
		s3PathToTrim      string
		prefix            string
		jobId             string
	}
	CalculateDestinationInterface interface {
		calculateDestination(s3Key string) (string, error)
	}
)

// Discover is responsible for recursively listing all s3 object keys in the given s3 paths and create
// tasks for the transfer job. The task generated will not have LocalFile for s3Discovery.
func (s3d *S3Discovery) Discover(s3Prefixes []string, s3Manager transferapi.S3Manager,
	calculateDestinationInterface CalculateDestinationInterface) ([]*jobmanagertypes.Task, []error) {
	output := make([]*jobmanagertypes.Task, 0)
	s3PathsSet := make(map[string]bool)
	discoveryErrors := make([]error, 0)
	for _, s3Prefix := range s3Prefixes {
		// whenever the s3Prefix is "/", we need to change it to empty string "" so that it will list all folders inside the s3 bucket
		if s3Prefix == "/" {
			s3Prefix = ""
		}

		listObjectsOutput, err := s3Manager.ListObjects(s3Prefix)
		if err != nil {
			discoveryErrors = append(discoveryErrors, discovery.NewDiscoveryError(discovery.StrFailedListingS3Objects, s3Prefix, err))
			continue
		}
		for _, s3Object := range listObjectsOutput.S3Objects {
			// Ignore the Glacier storage class since the tool doesn't support it
			if s3Object.StorageClass == string(types.ObjectStorageClassGlacierIr) ||
				s3Object.StorageClass == string(types.ObjectStorageClassDeepArchive) {
				err = fmt.Errorf(discovery.StrDownloadGlacierFileError, s3Object.Key, s3Object.StorageClass)
				discoveryErrors = append(discoveryErrors, err)
				continue
			}
			// Ignore the folder as the key since it will not be a real s3 object
			if !strings.HasSuffix(s3Object.Key, "/") {
				destination, calculateDestinationErr := calculateDestinationInterface.calculateDestination(s3Object.Key)
				if calculateDestinationErr != nil {
					discoveryErrors = append(discoveryErrors, calculateDestinationErr)
					continue
				}

				// Check if the object key is added to the set, if not, add s3 object path into the set for deduplication
				if !s3PathsSet[s3Object.Key] {
					s3PathsSet[s3Object.Key] = true
					// create the job for the s3 object
					task, taskErr := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
						Destination: destination,
						S3Object: jobmanagertypes.S3Object{
							Key:          s3Object.Key,
							LastModified: *s3Object.LastModified,
							Size:         s3Object.Size,
						},
						JobId:         s3d.jobId,
						TaskDirection: jobmanagertypes.TaskDirectionDownload,
					})
					output = append(output, task)
					if taskErr != nil {
						discoveryErrors = append(discoveryErrors, taskErr)
						continue
					}
				}
			}
		}
	}
	return output, discoveryErrors
}

// calculateDestination is to calculate the file destination from s3 to local file system by concatenating
// the prefix flag (if set) with given destination Folder.
// For example, s3 key as "my/s3/object.txt", customer choose the destination folder like "my/local-folder", and
// the prefix flag is set to  my-prefix/ the result destination should be "my-prefix/my/local-folder/my/s3/object.txt"
// following destination prefix + folder + s3 prefix
func (s3d *S3Discovery) calculateDestination(s3key string) (string, error) {
	var destination = s3d.destinationFolder
	if s3d.prefix != "" {
		destination = filepath.Join(s3d.prefix, s3d.destinationFolder)
	}
	s3key = strings.TrimPrefix(s3key, s3d.s3PathToTrim)
	s3key = sanitizeS3ObjectName(s3key, InvalidS3KeyStrings)
	if transferapi.ContainsUnsafeS3Chars(s3key) {
		events.Events.Warn(discovery.StrContainsUnsafeChars, s3key)
	}
	destination = filepath.Join(destination, s3key)
	if err := discovery.ValidatePathLength(destination); err != nil {
		return "", err
	}

	if strings.HasSuffix(s3key, "/") {
		destination += string(filepath.Separator)
	}
	return destination, nil
}

// sanitizeS3ObjectName take a S3 key, and replaces any invalid strings in the key with underscores
func sanitizeS3ObjectName(name string, invalidCharacters []string) string {
	containsInvalidCharacters := false
	for _, invalidCharacter := range invalidCharacters {
		if strings.Contains(name, invalidCharacter) {
			containsInvalidCharacters = true
			break
		}
	}
	if !containsInvalidCharacters {
		return name
	}

	replacementName := name
	for _, invalidCharacter := range invalidCharacters {
		replacementName = strings.ReplaceAll(replacementName, invalidCharacter, "_")
	}
	events.Events.Send(&eventtypes.AlertEvent{
		Msg:   fmt.Sprintf(discovery.StrKeyContainsSlash, name, replacementName),
		Level: eventtypes.Warning,
	})
	return replacementName
}

func NewS3Discovery(prefix string, jobId string, destinationFolder string, s3PathToTrim string) S3Discovery {
	return S3Discovery{
		prefix:            prefix,
		jobId:             jobId,
		destinationFolder: destinationFolder,
		s3PathToTrim:      s3PathToTrim,
	}
}
