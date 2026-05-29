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

	numBytesDownloaded, err := downloader.Download(input.Context, input.Writer, &s3.GetObjectInput{
		Bucket: aws.String(s3m.Bucket),
		Key:    aws.String(input.Key),
	},
		WithDownloadSettings(AutoTuningConfig{
			SourceSize:  input.SourceSize,
			AutoTuning:  input.AutoTune,
			MemoryLimit: input.MemoryLimit,
		}),
	)
	if input.Context.Err() != nil {
		return numBytesDownloaded, context.Cause(input.Context)
	}
	return numBytesDownloaded, err
}
