package transfer_api

import (
	"context"
	"os"
	"sync/atomic"
	"time"
)

// FileReader is a wrapper struct around file read operations, allowing us to track rudimentary read speeds from disk
//
//revive:disable nested-structs
type FileReader struct {
	File  *os.File
	Size  int64
	Start time.Time
	// Ctx carries the owning transfer's cancellation so a rate-limit wait
	// unblocks immediately when the job is paused or cancelled. May be nil.
	Ctx  context.Context
	read int64
}

func (r *FileReader) Read(p []byte) (int, error) {
	// Charge the limiter for the requested size (len(p)) before the read, not
	// the number of bytes actually returned. A short read or EOF tail debits a
	// few unused tokens, which makes Target Bandwidth a conservative ceiling
	// (it can sit a hair under target) rather than risking an overshoot. This
	// is a deliberate trade: charging after the read would let the first read
	// of each part through unthrottled.
	if err := throttle(r.Ctx, len(p)); err != nil {
		return 0, err
	}
	return r.File.Read(p)
}

func (r *FileReader) ReadAt(p []byte, offset int64) (int, error) {
	if err := throttle(r.Ctx, len(p)); err != nil {
		return 0, err
	}

	n, err := r.File.ReadAt(p, offset)
	if err != nil {
		return n, err
	}
	atomic.AddInt64(&r.read, int64(n))
	return n, err
}

func (r *FileReader) Seek(offset int64, whence int) (int64, error) {
	return r.File.Seek(offset, whence)
}

func (r *FileReader) BytesRead() int64 {
	if atomic.LoadInt64(&r.read) < r.Size {
		return atomic.LoadInt64(&r.read)
	}
	return atomic.LoadInt64(&r.read) - r.Size
}
