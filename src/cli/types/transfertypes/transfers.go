package transfer

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

// IncVal increments the transfer counter by value
func (a *transfers) IncVal(direction Direction, value int32) {
    switch direction {
    case Upload:
        atomic.AddInt32(&a.Uploads, value)
    case Download:
        atomic.AddInt32(&a.Downloads, value)
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

// TotalCount returns the combined count of active uploads and downloads
func (a *transfers) TotalCount() int32 {
    return a.DownloadsCount() + a.UploadsCount()
}
