package fs

import (
    "os"
    "sync"
    "sync/atomic"
    "time"
)

// FileReader is a wrapper struct around file read operations, allowing us to track rudimentary read speeds from disk
//
//revive:disable nested-structs
type FileReader struct {
    File    *os.File
    Size    int64
    Start   time.Time
    read    int64
    signMap map[int64]struct{}
    mutex   sync.Mutex
}

//revive:enable nested-structs

// Speed returns a human-readable string format of the current speed of the read operations
func (r *FileReader) Speed() float64 {
    now := time.Now()
    return float64(atomic.LoadInt64(&r.read)) / now.Sub(r.Start).Seconds()
}

func (r *FileReader) Read(p []byte) (int, error) {
    return r.File.Read(p)
}

func (r *FileReader) ReadAt(p []byte, offset int64) (int, error) {
    n, err := r.File.ReadAt(p, offset)
    if err != nil {
        return n, err
    }

    r.mutex.Lock()
    defer r.mutex.Unlock()
    if r.signMap == nil {
        r.signMap = make(map[int64]struct{})
    }
    // GO sdk reads the file from disk twice, so ignore the first signature call since the upload has not begun yet
    if _, ok := r.signMap[offset]; ok {
        atomic.AddInt64(&r.read, int64(n))
    } else {
        r.signMap[offset] = struct{}{}
    }
    return n, err
}

func (r *FileReader) Seek(offset int64, whence int) (int64, error) {
    return r.File.Seek(offset, whence)
}

func (r *FileReader) BytesRead() int64 {
    if atomic.LoadInt64(&r.read)-r.Size < 0 {
        return atomic.LoadInt64(&r.read)
    }
    return atomic.LoadInt64(&r.read) - r.Size
}
