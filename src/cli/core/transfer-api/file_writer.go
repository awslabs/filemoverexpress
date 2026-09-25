package transfer_api

import (
	"context"
	"os"
	"sync/atomic"
	"time"
)

// FileWriter is a wrapper struct around file write operations, allowing us to track rudimentary write speeds from disk
type FileWriter struct {
	File  *os.File
	Size  int64
	Start time.Time
	// Ctx carries the owning transfer's cancellation so a rate-limit wait
	// unblocks immediately when the job is paused or cancelled. May be nil.
	Ctx     context.Context
	written int64
}

func (w *FileWriter) Write(p []byte) (int, error) {
	if err := throttle(w.Ctx, len(p)); err != nil {
		return 0, err
	}
	return w.File.Write(p)
}

func (w *FileWriter) WriteAt(p []byte, offset int64) (int, error) {
	if err := throttle(w.Ctx, len(p)); err != nil {
		return 0, err
	}

	n, err := w.File.WriteAt(p, offset)
	if err != nil {
		return n, err
	}

	atomic.AddInt64(&w.written, int64(n))

	return n, err
}

func (w *FileWriter) Seek(offset int64, whence int) (int64, error) {
	return w.File.Seek(offset, whence)
}

func (w *FileWriter) BytesWritten() int64 {
	if atomic.LoadInt64(&w.written) < w.Size {
		return atomic.LoadInt64(&w.written)
	}
	return atomic.LoadInt64(&w.written) - w.Size
}
