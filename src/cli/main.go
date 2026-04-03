package main

import (
    "fmt"
    "os"
    "path/filepath"
    "time"

    "github.com/fsnotify/fsnotify"
    "github.com/mitchellh/panicwrap"
    "github.com/sirupsen/logrus"
    "github.com/spf13/viper"

    "github.com/awslabs/filemoverexpress/cmd"
    "github.com/awslabs/filemoverexpress/config"
    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/core"
    transferapi "github.com/awslabs/filemoverexpress/core/transfer-api"
    "github.com/awslabs/filemoverexpress/core/upload/hot_folder"
    "github.com/awslabs/filemoverexpress/events"
    "github.com/awslabs/filemoverexpress/globals"
    "github.com/awslabs/filemoverexpress/logger"
    "github.com/awslabs/filemoverexpress/types/daemontypes/daemonutils"
    "github.com/awslabs/filemoverexpress/types/eventtypes"
    "github.com/awslabs/filemoverexpress/utils"
    "github.com/awslabs/filemoverexpress/utils/supportfile"
)

var Version string

func initialize() {
    globals.GetInstance().GetCfg()
    config.WatchConfig(ReloadConfigUpdates)

    setupLogger()

    go func() {
        time.Sleep(8 * time.Second)
        memoryLimit := supportfile.GetMemoryInformation().TotalBytes
        if memoryLimit < 6*constants.GiB {
            evt := &eventtypes.AlertEvent{
                Msg:           core.StrLowRam,
                EventPriority: logger.WarnLevel,
                Level:         eventtypes.Warning,
            }
            events.Events.Send(evt)
        }
    }()
}

func main() {
    exitStatus, err := panicwrap.Wrap(&panicwrap.WrapConfig{
        Handler:   panicHandler,
        HidePanic: true,
    })
    if err != nil {
        panic("Failed to setup panic handler")
    }

    defer daemonutils.DeletePidFile()

    if exitStatus >= 0 {
        os.Exit(exitStatus)
    }

    initialize()
    if Version == "" {
        Version = "0.0.0-local-dev"
    }
    cmd.Execute(Version)
}

func setupLogger() {
    level, logpath := getSevAndPath()
    loglevel, err := logrus.ParseLevel(level)
    if err != nil {
        loglevel = logrus.WarnLevel
    }

    err = logger.Init(&logger.Config{
        Severity: loglevel,
        LogPath:  logpath,
        MaxSize:  viper.GetInt("logging.max_size"),
        MaxAge:   viper.GetInt("logging.max_age"),
        Compress: viper.GetBool("logging.compress"),
    })
    if err != nil {
        fmt.Printf("Failed configuring logging output: %s\n", err)
    }
}

func getSevAndPath() (severity string, logPath string) {
    severity = viper.GetString("logging.severity")
    logPath = viper.GetString("logging.directory")

    if logPath != "" {
        if !filepath.IsAbs(logPath) {
            var err error
            logPath, err = filepath.Abs(filepath.Join(config.GetConfigDir(), logPath))
            if err != nil {
                fmt.Printf("Failed to build log file path: %s\n", err)
            }
        }
    }

    return severity, logPath
}

func panicHandler(output string) {
    daemonutils.DeletePidFile()
    utils.LogPanic(output)
    os.Exit(1)
}

func ReloadConfigUpdates(_ fsnotify.Event) {
    globals.GetInstance().ReloadCfg()
    configUpdateEvent := eventtypes.ConfigurationUpdateEvent{}
    events.Events.Send(&configUpdateEvent)
    transferapi.SetTargetBPS(int64(globals.GetInstance().GetCfg().General.TargetBandwidth) * constants.MiB)
    hotFolders := globals.GetInstance().GetCfg().UploadHotFolders

    hot_folder.RemoveOldHotFolders()
    for _, hotFolder := range hotFolders {
        hotFolderTransferConfigs := hotFolder.RemoteConfigurations
        hotFolderConfigMap := make(map[string]string)
        for _, transferConfig := range hotFolderTransferConfigs {
            hotFolderConfigMap[transferConfig.RemoteConfigurationName] = transferConfig.S3DestinationFolder
        }
        newHotFolder := hot_folder.HotFolder{
            Name:                                  hotFolder.Name,
            Enabled:                               hotFolder.Enabled,
            SourceFolder:                          hotFolder.LocalSourceFolder,
            TransferProfilesAndDestinationFolders: hotFolderConfigMap,
        }
        shouldStartUpload := hot_folder.ConfigureHotFolderWatcher(newHotFolder)
        if shouldStartUpload && hotFolder.Enabled {
            go hot_folder.HotFolderUploadSourceDirectory(&newHotFolder)
        }
    }
}
