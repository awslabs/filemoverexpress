package transfer_api

import (
	"os"
	"sync/atomic"
	"time"

	transfer "github.com/awslabs/filemoverexpress/types/transfertypes"
)

// FileWriter is a wrapper struct around file write operations, allowing us to track rudimentary write speeds from disk
type FileWriter struct {
	File    *os.File
	Size    int64
	Start   time.Time
	written int64
}

func (w *FileWriter) Write(p []byte) (int, error) {
	return w.File.Write(p)
}

func (w *FileWriter) WriteAt(p []byte, offset int64) (int, error) {
	if IsThrottled() {
		sleepTime := GetSleepTime(transfer.Download)
		time.Sleep(sleepTime)
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
