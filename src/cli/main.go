package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/mitchellh/panicwrap"
	"github.com/sirupsen/logrus"

	"github.com/awslabs/filemoverexpress/cmd"
	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/core"
	transferapi "github.com/awslabs/filemoverexpress/core/transfer-api"
	"github.com/awslabs/filemoverexpress/core/upload/hot_folder"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/daemontypes/daemonutils"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
	"github.com/awslabs/filemoverexpress/utils"
	"github.com/awslabs/filemoverexpress/utils/supportfile"
)

var Version string

func initialize() {
	config.InitConfig()
	config.WatchConfig(ReloadConfigUpdates)
	setupLogger()

	// Initialize services that require config before use
	transferapi.InitThrottling()

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
	cfg := config.LoadConfiguration()
	logDirectory := configureLogDirectory(cfg)
	loglevel, err := logrus.ParseLevel(cfg.Logging.Severity)
	if err != nil {
		loglevel = logrus.WarnLevel
	}

	err = logger.Init(&logger.Config{
		Severity: loglevel,
		LogPath:  logDirectory,
		MaxSize:  cfg.Logging.MaxSize,
		MaxAge:   cfg.Logging.MaxAge,
		Compress: cfg.Logging.Compress,
	})
	if err != nil {
		fmt.Printf("Failed configuring logging output: %s\n", err)
	}
}

func configureLogDirectory(cfg configtypes.FmeConfig) string {
	logPath := cfg.Logging.Directory
	if logPath != "" {
		if !filepath.IsAbs(logPath) {
			var err error
			logPath, err = filepath.Abs(filepath.Join(config.GetConfigDir(), logPath))
			if err != nil {
				fmt.Printf("Failed to build log file path: %s\n", err)
			}
		}
	}

	return logPath
}

func panicHandler(output string) {
	daemonutils.DeletePidFile()
	utils.LogPanic(output)
	os.Exit(1)
}

func ReloadConfigUpdates(cfg configtypes.FmeConfig) {
	configUpdateEvent := eventtypes.ConfigurationUpdateEvent{}
	events.Events.Send(&configUpdateEvent)

	transferapi.SetTargetBPS(int64(cfg.General.TargetBandwidth) * constants.MiB)
	hotFolders := cfg.UploadHotFolders

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
			ForceInitialUpload:                    hotFolder.ForceInitialUpload,
			TransferProfilesAndDestinationFolders: hotFolderConfigMap,
		}
		shouldStartUpload := hot_folder.ConfigureHotFolderWatcher(newHotFolder)
		if shouldStartUpload && hotFolder.Enabled {
			go hot_folder.HotFolderUploadSourceDirectory(&newHotFolder)
		}
	}
}
