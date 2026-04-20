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

type XxhashChecksummer struct {
}

func (*XxhashChecksummer) ChecksumFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", err
		}

		return "", retry.RetryableError(err)
	}

	defer fs.CloseFile(fs.CloseFileInput{
		File: f,
		Exit: false,
	})

	h := xxhash.New32()
	if _, err := io.Copy(h, f); err != nil {
		return "", retry.RetryableError(err)
	}

	return strconv.FormatInt(int64(h.Sum32()), constants.BaseHex), nil
}
