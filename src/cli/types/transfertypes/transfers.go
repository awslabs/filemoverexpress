package transfertypes

import "sync/atomic"

var (
	ActiveTransfers = transfers{
		Uploads:   0,
		Downloads: 0,
	}
)

type transfers struct {
	Uploads   int32
	Downloads int32
}

// Inc increments the transfer counter by one
func (a *transfers) Inc(direction Direction) {
	switch direction {
	case Upload:
		atomic.AddInt32(&a.Uploads, 1)
	case Download:
		atomic.AddInt32(&a.Downloads, 1)
	}
}

// Dec deletes a transfer object from transfers
func (a *transfers) Dec(direction Direction) {
	switch direction {
	case Upload:
		atomic.AddInt32(&a.Uploads, -1)
	case Download:
		atomic.AddInt32(&a.Downloads, -1)
	}
}

// UploadsCount returns the count of active uploads
func (a *transfers) UploadsCount() int32 {
	return atomic.LoadInt32(&a.Uploads)
}

// DownloadsCount returns the count of active uploads
func (a *transfers) DownloadsCount() int32 {
	return atomic.LoadInt32(&a.Downloads)
}
