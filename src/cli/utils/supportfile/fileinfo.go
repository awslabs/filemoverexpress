package supportfile

import (
    "os"
    "time"
)

type fileInfo struct {
    name    string
    size    int64
    mode    os.FileMode
    modTime time.Time
    isDir   bool
}

func (fi *fileInfo) Name() string {
    return fi.name
}

func (fi *fileInfo) Size() int64 {
    return fi.size
}

func (fi *fileInfo) Mode() os.FileMode {
    return fi.mode
}

func (fi *fileInfo) ModTime() time.Time {
    return fi.modTime
}

func (fi *fileInfo) IsDir() bool {
    return fi.isDir
}

func (*fileInfo) Sys() interface{} {
    return nil
}
