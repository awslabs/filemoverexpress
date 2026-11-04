package transfer_api

import (
	"context"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type DownloadConfig struct {
	AutoTune    bool
	ChunkSize   int64
	Context     context.Context
	Key         string
	MemoryLimit int64
	SourceSize  int64
	Threads     int
	Writer      io.WriterAt
	// Adaptive, when true, applies Threads/ChunkSize as explicit per-call multipart
	// settings and acquires Threads tokens from the global connection limiter for the
	// duration of the download, so downloads share the same OS-safe pool budget as
	// uploads (the semaphore is the real governor for both directions).
	Adaptive bool
}

//nolint:staticcheck // Pending TransferManagerV2 migration
func (s3m *S3Manager) Download(input DownloadConfig) (int64, error) {
	s3m.Lock.RLock()
	downloader := s3m.Downloader
	s3m.Lock.RUnlock()
	if downloader == nil {
		downloader = manager.NewDownloader(s3m.Client, func(d *manager.Downloader) {
			d.PartSize = input.ChunkSize
			d.Concurrency = input.Threads
		})
	}
	s3m.Lock.Lock()
	s3m.Downloader = downloader
	s3m.Lock.Unlock()

	opts := []func(*manager.Downloader){
		WithDownloadSettings(AutoTuningConfig{
			SourceSize:  input.SourceSize,
			AutoTuning:  input.AutoTune,
			MemoryLimit: input.MemoryLimit,
		}),
	}
	if input.Adaptive {
		opts = append(opts, withExplicitDownloadSettings(input.Threads, input.ChunkSize))
		release, acqErr := acquireConnections(input.Context, input.Threads)
		if acqErr != nil {
			return 0, acqErr
		}
		defer release()
	}

	numBytesDownloaded, err := downloader.Download(input.Context, input.Writer, &s3.GetObjectInput{
		Bucket: aws.String(s3m.Bucket),
		Key:    aws.String(input.Key),
	}, opts...)
	if input.Context.Err() != nil {
		return numBytesDownloaded, context.Cause(input.Context)
	}
	return numBytesDownloaded, err
}
