package checksums

import (
    "io"
    "os"
    "strconv"

    "github.com/OneOfOne/xxhash"
    "github.com/sethvargo/go-retry"

    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/utils/fs"
)

type Xxhash64Checksummer struct {
}

func (*Xxhash64Checksummer) ChecksumFile(path string) (string, error) {
    fh, err := os.Open(path)
    if err != nil {
        if os.IsNotExist(err) {
            return "", err
        }
        return "", retry.RetryableError(err)
    }

    defer fs.CloseFile(fs.CloseFileInput{
        File: fh,
        Exit: false,
    })

    h := xxhash.New64()
    if _, err := io.Copy(h, fh); err != nil {
        return "", retry.RetryableError(err)
    }

    return strconv.FormatUint(h.Sum64(), constants.BaseHex), nil
}
