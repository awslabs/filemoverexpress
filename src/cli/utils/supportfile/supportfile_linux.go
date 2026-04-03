//go:build linux
// +build linux

package supportfile

import (
    "syscall"

    "github.com/awslabs/filemoverexpress/events"
    "github.com/awslabs/filemoverexpress/types/supportfiletypes"
)

func GetLimits() []supportfiletypes.Limit {
    var nofile, maxprocs syscall.Rlimit
    nproc := 0x6
    output := make([]supportfiletypes.Limit, 0)

    // Max Open Files
    if err := syscall.Getrlimit(syscall.RLIMIT_NOFILE, &nofile); err != nil {
        events.Events.Warn(strFailedGettingRLimit, err.Error())
        return nil
    }

    output = append(output, supportfiletypes.Limit{
        Type: "MaxOpenFiles",
        Soft: nofile.Cur,
        Hard: nofile.Max,
    })

    // Max Processes
    if err := syscall.Getrlimit(nproc, &maxprocs); err != nil {
        events.Events.Warn(strFailedGettingRLimit, err.Error())
        return nil
    }
    output = append(output, supportfiletypes.Limit{
        Type: "MaxProcesses",
        Soft: maxprocs.Cur,
        Hard: maxprocs.Max,
    })

    return output
}
