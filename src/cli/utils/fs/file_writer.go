package fs

import (
	"os"
	"sync/atomic"
	"time"
)

// FileWriter is a wrapper struct around file write operations, allowing us to track rudimentary write speeds from disk
type FileWriter struct {
	File    *os.File
	Size    int64
	Start   time.Time
	written int64
}

// Speed returns a human-readable string format of the current speed of the write operations
func (r *FileWriter) Speed() float64 {
	now := time.Now()
	return float64(atomic.LoadInt64(&r.written)) / now.Sub(r.Start).Seconds()
}

func (r *FileWriter) Write(p []byte) (int, error) {
	return r.File.Write(p)
}

func (r *FileWriter) WriteAt(p []byte, offset int64) (int, error) {
	n, err := r.File.WriteAt(p, offset)
	if err != nil {
		return n, err
	}

	atomic.AddInt64(&r.written, int64(n))

	return n, err
}

func (r *FileWriter) Seek(offset int64, whence int) (int64, error) {
	return r.File.Seek(offset, whence)
}

func (r *FileWriter) BytesWritten() int64 {
	if atomic.LoadInt64(&r.written)-r.Size < 0 {
		return atomic.LoadInt64(&r.written)
	}
	return atomic.LoadInt64(&r.written) - r.Size
}
