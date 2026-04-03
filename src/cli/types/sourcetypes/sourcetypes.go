package sourcetypes

import (
    "github.com/awslabs/filemoverexpress/types/checksumtypes"
)

type (
    Source struct {
        Key  string
        Size int64
    }
    SourceFile struct {
        Id        string
        Path      string
        Size      int64
        Checksums *checksumtypes.Checksum
    }
)
