package config

import (
	"os"
	"os/user"
	"path/filepath"
	"time"

	"github.com/spf13/viper"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/events"
)

func makeConfigDir(configDir string) os.FileInfo {
	if mkErr := os.MkdirAll(configDir, 0700); mkErr != nil {
		events.Events.Fatal(strFailedCreatingDir, mkErr)
	}
	dInfo, err := os.Stat(configDir)
	if err != nil {
		events.Events.Fatal(strFailedReadingDir, err)
	}
	return dInfo
}

func createConfigIfNotExists(viperInstance *viper.Viper, configFile string) {
	_, err := os.Stat(configFile)

	if os.IsNotExist(err) {
		configLock.Lock()
		defer configLock.Unlock()

		if cErr := viperInstance.WriteConfigAs(configFile); cErr != nil {
			events.Events.Fatal(strFailedWritingFile, err)
		}
	}
}

func setupConfigFileAndDirectory() (configFile string, configDir string) {
	configDir = GetConfigDir()
	configFile = filepath.Join(configDir, GetConfigName()+"."+constants.ConfigFileExt)
	dInfo, err := os.Stat(configDir)

	if os.IsNotExist(err) {
		dInfo = makeConfigDir(configDir)
	}

	if !dInfo.IsDir() {
		events.Events.Fatal(strPathExistsAndNotDir, configDir)
	}
	return configFile, configDir
}

// GetConfigDir returns directory the config file and database file are in
func GetConfigDir() string {
	// use environment variable value if exists and not empty
	if envConfigDir, exists := os.LookupEnv("FME_CONFIG_DIR"); exists {
		return envConfigDir
	}

	usr, err := user.Current()
	if err != nil {
		events.Events.Fatal(strFailedGettingHomeDir, err)
		time.Sleep(time.Second)
	}

	return filepath.Join(usr.HomeDir, constants.DefaultAppDir)
}

func GetLogDir() string {
	cfgDir := GetConfigDir()
	cfg := LoadConfiguration()

	if cfg.Logging.Directory == "" {
		return filepath.Join(configDir, "logs")
	}

	if filepath.IsAbs(cfg.Logging.Directory) {
		return cfg.Logging.Directory
	}

	return filepath.Join(cfgDir, cfg.Logging.Directory)
}
