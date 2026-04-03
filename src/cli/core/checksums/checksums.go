package checksums

import (
    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/events"
)

func NewChecksummer(algorithm constants.ChecksumAlgorithm) (FileMoverChecksummer, error) {
    switch algorithm {
    case constants.AlgorithmMD5:
        return &MD5HexChecksummer{}, nil
    case constants.AlgorithmXXHash:
        return &XxhashChecksummer{}, nil
    case constants.AlgorithmXXHash64:
        return &Xxhash64Checksummer{}, nil
    case constants.AlgorithmXXH3:
        return &Xxh3Checksummer{}, nil
    case constants.AlgorithmNone:
        return &NoneChecksummer{}, nil
    default:
        events.Events.Warn("Invalid or missing checksum algorithm. Defaulting to use Xxhash")
        return &XxhashChecksummer{}, nil
    }
}
