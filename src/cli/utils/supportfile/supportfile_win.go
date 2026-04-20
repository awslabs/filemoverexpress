//go:build windows
// +build windows

package supportfile

import (
	"syscall"

	"golang.org/x/sys/windows"

	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/types/supportfiletypes"
)

func GetLimits() []supportfiletypes.Limit {
	output := make([]supportfiletypes.Limit, 0)

	dll := windows.NewLazyDLL("ucrtbase.dll")
	proc := dll.NewProc("_getmaxstdio")
	maxOpenFiles, _, err := proc.Call()
	if err != syscall.Errno(0) {
		events.Events.Warn(strFailedGettingRLimit, err.Error())
		return nil
	}
	output = append(output, supportfiletypes.Limit{
		Type: "MaxOpenFiles",
		Soft: 0,
		Hard: uint64(maxOpenFiles),
	})

	return output
}
