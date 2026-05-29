package transfer_api

import (
	"math"

	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"

	"github.com/awslabs/filemoverexpress/constants"
)

// nolint:mnd
var transferSettings = []TransferSettings{
	{
		Limit:     15 * constants.MiB,
		Threads:   1,
		ChunkSize: 15 * constants.MiB,
	},
	{
		Limit:     50 * constants.MiB,
		Threads:   10,
		ChunkSize: 5 * constants.MiB,
	},
	{
		Limit:     100 * constants.MiB,
		Threads:   10,
		ChunkSize: 10 * constants.MiB,
	},
	{
		Limit:     250 * constants.MiB,
		Threads:   25,
		ChunkSize: 10 * constants.MiB,
	},
	{
		Limit:     500 * constants.MiB,
		Threads:   50,
		ChunkSize: 10 * constants.MiB,
	},
	{
		Limit:     750 * constants.MiB,
		Threads:   75,
		ChunkSize: 10 * constants.MiB,
	},
	{
		Limit:     1000 * constants.MiB,
		Threads:   100,
		ChunkSize: 10 * constants.MiB,
	},
	{
		Limit:     2000 * constants.MiB,
		Threads:   50,
		ChunkSize: 40 * constants.MiB,
	},
	{
		Limit:     2500 * constants.MiB,
		Threads:   50,
		ChunkSize: 50 * constants.MiB,
	},
	{
		Limit:     3000 * constants.MiB,
		Threads:   50,
		ChunkSize: 60 * constants.MiB,
	},
	{
		Limit:     4000 * constants.MiB,
		Threads:   50,
		ChunkSize: 80 * constants.MiB,
	},
	{
		Limit:     5000 * constants.MiB,
		Threads:   50,
		ChunkSize: 100 * constants.MiB,
	},
	{
		// ~9 exabytes
		Limit:     math.MaxInt64,
		Threads:   100,
		ChunkSize: 150 * constants.MiB,
	},
}

type (
	TransferSettings struct {
		Limit     int64
		Threads   int
		ChunkSize int64
	}
	AutoTuningConfig struct {
		SourceSize  int64
		AutoTuning  bool
		MemoryLimit int64
	}
	//nolint:staticcheck // Pending TransferManagerV2 migration
	TransferClient interface {
		manager.Uploader | manager.Downloader
	}
)

//nolint:staticcheck // Pending TransferManagerV2 migration
func WithDownloadSettings(input AutoTuningConfig) func(*manager.Downloader) {
	if !input.AutoTuning {
		return func(_ *manager.Downloader) {}
	}
	for settingsIndex, settings := range transferSettings {
		if settingsIndex > 0 && settings.ChunkSize*int64(settings.Threads) >= input.MemoryLimit {
			previousSettings := transferSettings[settingsIndex-1]
			return func(downloader *manager.Downloader) {
				downloader.Concurrency = previousSettings.Threads
				downloader.PartSize = previousSettings.ChunkSize
			}
		}
		if input.SourceSize <= settings.Limit {
			return func(downloader *manager.Downloader) {
				downloader.Concurrency = settings.Threads
				downloader.PartSize = settings.ChunkSize
			}
		}
	}
	return func(_ *manager.Downloader) {}
}

//nolint:staticcheck // Pending TransferManagerV2 migration
func WithUploadSettings(input AutoTuningConfig) func(uploader *manager.Uploader) {
	if !input.AutoTuning {
		return func(_ *manager.Uploader) {}
	}
	for settingsIndex, settings := range transferSettings {
		if settingsIndex > 0 && settings.ChunkSize*int64(settings.Threads) >= input.MemoryLimit {
			previousSettings := transferSettings[settingsIndex-1]
			return func(uploader *manager.Uploader) {
				uploader.Concurrency = previousSettings.Threads
				uploader.PartSize = previousSettings.ChunkSize
			}
		}
		if input.SourceSize <= settings.Limit {
			return func(uploader *manager.Uploader) {
				uploader.Concurrency = settings.Threads
				uploader.PartSize = settings.ChunkSize
			}
		}
	}
	return func(_ *manager.Uploader) {}
}
