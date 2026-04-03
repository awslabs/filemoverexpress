package discovery

import (
    "os"

    "github.com/awslabs/filemoverexpress/events"
    ftErrors "github.com/awslabs/filemoverexpress/fme-errors"
)

func ValidateSourceSymlink(source string) error {
    info, err := os.Lstat(source)
    if err != nil {
        return err
    }

    if info.Mode()&os.ModeSymlink == os.ModeSymlink {
        return ftErrors.ErrSourceIsSymlink
    }

    return nil
}

func ValidateFileAccess(source string) error {
    fh, err := os.Open(source)
    if err != nil {
        if os.IsNotExist(err) {
            return NewDiscoveryError(StrSourceDoesNotExists, source)
        }

        return NewDiscoveryError(StrFailedListingDir, source)
    }

    if err := fh.Close(); err != nil {
        events.Events.Warn("Failed closing file handle: %s", err)
    }

    return nil
}
