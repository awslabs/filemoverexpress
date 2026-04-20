package checksums

import (
	"os"
	"path/filepath"
	"strconv"

	"github.com/sethvargo/go-retry"
	"github.com/zeebo/xxh3"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/utils/fs"
)

type Xxh3Checksummer struct {
}

func (*Xxh3Checksummer) ChecksumFile(path string) (string, error) {
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

	b, err := os.ReadFile(filepath.Clean(fh.Name()))
	if err != nil {
		return "", retry.RetryableError(err)
	}

	return strconv.FormatUint(xxh3.Hash(b), constants.BaseHex), nil
}
