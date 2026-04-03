package transfer_api

import (
    "os"
    "sync/atomic"
    "time"

    transfer "github.com/awslabs/filemoverexpress/types/transfertypes"
)

// FileReader is a wrapper struct around file read operations, allowing us to track rudimentary read speeds from disk
//
//revive:disable nested-structs
type FileReader struct {
    File  *os.File
    Size  int64
    Start time.Time
    read  int64
}

func (r *FileReader) Read(p []byte) (int, error) {
    return r.File.Read(p)
}

func (r *FileReader) ReadAt(p []byte, offset int64) (int, error) {
    if IsThrottled() {
        sleepTime := GetSleepTime(transfer.Upload)
        time.Sleep(sleepTime)
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
