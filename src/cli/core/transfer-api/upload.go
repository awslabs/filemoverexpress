package transfer_api

import (
	"context"
	"io"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"

	"github.com/awslabs/filemoverexpress/events"
)

type UploadConfig struct {
	AutoTune          bool
	Checksum          string
	ChecksumAlgorithm string
	ChunkSize         int64
	Context           context.Context
	FilePath          string
	FileSize          int64
	Destination       string
	MemoryLimit       int64
	Reader            io.Reader
	StorageClass      string
	Threads           int
	// Adaptive, when true, applies Threads/ChunkSize as explicit per-call multipart
	// settings and acquires Threads tokens from the global connection limiter for the
	// duration of the upload.
	Adaptive bool
}

//nolint:staticcheck // Pending TransferManagerV2 migration
func (s3m *S3Manager) Upload(input UploadConfig) (*manager.UploadOutput, error) {
	s3m.Lock.RLock()
	uploader := s3m.Uploader
	s3m.Lock.RUnlock()
	if uploader == nil {
		uploader = manager.NewUploader(s3m.Client, func(d *manager.Uploader) {
			d.PartSize = input.ChunkSize
			d.Concurrency = input.Threads
		})
		s3m.Lock.Lock()
		s3m.Uploader = uploader
		s3m.Lock.Unlock()
	}

	awsStorageClass, err := convertToAWSStorageClass(input.StorageClass)
	if err != nil {
		return nil, err
	}

	metadata := make(map[string]string)
	if input.Checksum != "" {
		metadata[input.ChecksumAlgorithm] = input.Checksum
	}

	opts := []func(*manager.Uploader){
		WithUploadSettings(AutoTuningConfig{
			SourceSize:  input.FileSize,
			AutoTuning:  input.AutoTune,
			MemoryLimit: input.MemoryLimit,
		}),
	}
	if input.Adaptive {
		opts = append(opts, withExplicitUploadSettings(input.Threads, input.ChunkSize))
		release, acqErr := acquireConnections(input.Context, input.Threads)
		if acqErr != nil {
			return nil, acqErr
		}
		defer release()
	}

	uploadOutput, err := uploader.Upload(input.Context, &s3.PutObjectInput{
		Bucket:       aws.String(s3m.Bucket),
		Key:          aws.String(input.Destination),
		Body:         input.Reader,
		StorageClass: awsStorageClass,
		Metadata:     metadata,
	}, opts...)
	if input.Context.Err() != nil {
		return uploadOutput, context.Cause(input.Context)
	}

	return uploadOutput, err
}

func convertToAWSStorageClass(storageClass string) (types.StorageClass, error) {
	storageClass = strings.ReplaceAll(storageClass, " ", "_")
	switch strings.ToLower(storageClass) {
	case "standard":
		return types.StorageClassStandard, nil
	case "reduced_redundancy":
		return types.StorageClassReducedRedundancy, nil
	case "standard_ia":
		return types.StorageClassStandardIa, nil
	case "onezone_ia":
		return types.StorageClassOnezoneIa, nil
	case "intelligent_tiering":
		return types.StorageClassIntelligentTiering, nil
	case "glacier":
		return types.StorageClassGlacier, nil
	case "deep_archive":
		return types.StorageClassDeepArchive, nil
	case "glacier_ir":
		return types.StorageClassGlacierIr, nil
	default:
		events.Events.Warn("Invalid or missing storage class. Defaulting to use standard")
		return types.StorageClassStandard, nil
	}
}
