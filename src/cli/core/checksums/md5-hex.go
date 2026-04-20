package checksums

import (
	"crypto/md5"
	"fmt"
	"io"
	"os"

	"github.com/sethvargo/go-retry"

	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/utils/fs"
)

type MD5HexChecksummer struct {
}

func (*MD5HexChecksummer) ChecksumFile(path string) (string, error) {
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

	h := md5.New()
	if _, err = io.Copy(h, fh); err != nil {
		events.Events.Error(strFailedChecksum, fh.Name(), err)
		return "", retry.RetryableError(err)
	}

	return fmt.Sprintf("%x", h.Sum(nil)), nil
}
