//go:build windows

package discovery

import (
	"errors"

	"golang.org/x/sys/windows/registry"

	"github.com/awslabs/filemoverexpress/logger"
)

const (
	LongPathsKey  = `SYSTEM\CurrentControlSet\Control\FileSystem`
	LongPathsAttr = "LongPathsEnabled"
)

func ValidatePathLength(source string) error {
	if len(source) <= 260 || supportsLongFilePaths() {
		return nil
	}

	return NewDiscoveryError(StrPathTooLong, source)
}

func supportsLongFilePaths() bool {
	regKey, err := registry.OpenKey(
		registry.LOCAL_MACHINE,
		LongPathsKey,
		registry.QUERY_VALUE,
	)
	if err != nil {
		if !errors.Is(err, registry.ErrNotExist) {
			logger.Warn("Failed reading long path support reg key: %s", err)
		}
		return false
	}

	val, valType, err := regKey.GetIntegerValue(LongPathsAttr)
	if err != nil {
		if !errors.Is(err, registry.ErrNotExist) {
			logger.Warn("Failed reading long path support reg key attr: %s", err)
		}
		return false
	}

	if valType != registry.DWORD {
		logger.Warn("Invalid attribute type %d, expected 4", valType)
		return false
	}

	return val == 1
}
