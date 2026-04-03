//go:build windows

package main

import (
    "fmt"
    "os"
    "path/filepath"

    "windows-daemon-launcher/logger"

    "golang.org/x/sys/windows"
)

const (
    NoWindow      = windows.CREATE_NO_WINDOW
    UseStdHandles = windows.STARTF_USESTDHANDLES
    fmBinary      = "filemoverexpress.exe"
)

func main() {
    currentExe, err := os.Executable()
    if err != nil {
        logger.Logger.Error(fmt.Sprintf("Failed to get current directory", err))
        os.Exit(1)
    }

    cwd := filepath.Dir(currentExe)

    absPath := filepath.Join(cwd, fmBinary)
    creationFlags := NoWindow
    procSecAttr := windows.SecurityAttributes{}
    threadSecAttr := windows.SecurityAttributes{}
    outprocInfo := windows.ProcessInformation{}
    startupInfo := windows.StartupInfo{
        Flags:      UseStdHandles,
        ShowWindow: windows.SW_HIDE,
    }

    appName, err := windows.UTF16PtrFromString(absPath)
    if err != nil {
        logger.Logger.Error(fmt.Sprintf("Failed to convert app name: %s", err))
        os.Exit(1)
    }

    rawCmdLine := fmt.Sprintf("\"%s\" daemon", absPath)
    cmdLine, err := windows.UTF16PtrFromString(rawCmdLine)
    if err != nil {
        logger.Logger.Error(fmt.Sprintf("Failed to convert cmdLine: %s", err))
        os.Exit(1)
    }

    currentDir, err := windows.UTF16PtrFromString(cwd)
    if err != nil {
        logger.Logger.Error(fmt.Sprintf("Failed to convert current directory: %s", err))
        os.Exit(1)
    }

    logger.Logger.Info(fmt.Sprintf("Launching filetransfer daemon: %s", rawCmdLine))

    err = windows.CreateProcess(
        appName,
        cmdLine,
        &procSecAttr,
        &threadSecAttr,
        false,
        uint32(creationFlags),
        nil,
        currentDir,
        &startupInfo,
        &outprocInfo,
    )
    if err != nil {
        logger.Logger.Error(fmt.Sprintf("Failed to create process: %s", err))
        os.Exit(1)
    }

    logger.Logger.Info(fmt.Sprintf("Started daemon process with process id %d", outprocInfo.ProcessId))
}
