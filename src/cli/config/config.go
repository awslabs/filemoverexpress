package config

import (
	"fmt"
	"maps"
	"os"
	"sync"
	"sync/atomic"

	"github.com/fsnotify/fsnotify"
	"github.com/go-viper/mapstructure/v2"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
	"github.com/awslabs/filemoverexpress/utils"
	"github.com/awslabs/filemoverexpress/utils/systeminfo"
)

type (
	ReloadFn func(config configtypes.FmeConfig)
)

var (
	configFile, configDir string
	cachedCfg             atomic.Value // configtypes.FmeConfig
	initialized           bool
	fmeViper              *viper.Viper
	configLock            = sync.Mutex{}
)

func initViper() {
	if fmeViper == nil {
		fmeViper = viper.New()
	}

	fmeViper.SetConfigName(GetConfigName())
	fmeViper.SetConfigType(constants.ConfigFileExt)
	fmeViper.AddConfigPath(GetConfigDir())

	setGeneralDefaultSettings(fmeViper)
	setLoggingDefaultSettings(fmeViper)
	setReportingDefaultSettings(fmeViper)
	setS3DefaultSettings(fmeViper)
	setAPIServerDefaultSettings(fmeViper)

	LoadConfiguration()
}

func InitConfig() {
	configFile, configDir = setupConfigFileAndDirectory()
	initViper()
	createConfigIfNotExists(fmeViper, configFile)
	validateAndUpdateConfiguration()
}

// LoadConfiguration loads in values from the configuration file
func LoadConfiguration() configtypes.FmeConfig {
	if initialized {
		return cachedCfg.Load().(configtypes.FmeConfig)
	}

	return loadConfig()
}

func SaveConfig(cfg *configtypes.FmeConfig) error {
	var configMap map[string]interface{}
	tempViper := createViper()
	if decodeErr := mapstructure.Decode(*cfg, &configMap); decodeErr != nil {
		return decodeErr
	}

	if mergeErr := tempViper.MergeConfigMap(configMap); mergeErr != nil {
		return mergeErr
	}

	if writeErr := tempViper.WriteConfigAs(configFile); writeErr != nil {
		return writeErr
	}

	return nil
}

func BindFlag(key string, flag *pflag.Flag) error {
	return fmeViper.BindPFlag(key, flag)
}

func loadConfig() configtypes.FmeConfig {
	var loadedCfg configtypes.FmeConfig

	configLock.Lock()
	defer configLock.Unlock()

	tempViper := createViper()
	if err := tempViper.ReadInConfig(); err != nil {
		logger.Fatal("Error reading configuration file: %v", err)
	}

	if err := tempViper.Unmarshal(&loadedCfg); err != nil {
		logger.Fatal("Error parsing configuration file: %v", err)
	}

	loadedCfg = rekeyTransferProfilesByName(loadedCfg)
	cachedCfg.Store(loadedCfg)
	initialized = true

	return loadedCfg
}

func rekeyTransferProfilesByName(cfg configtypes.FmeConfig) configtypes.FmeConfig {
	for k, v := range cfg.Protocols.S3.TransferProfiles {
		v.Name = k
		cfg.Protocols.S3.TransferProfiles[k] = v
	}
	return cfg
}

// GetConfigName returns the name of the config file
func GetConfigName() string {
	if os.Getenv("FME_E2E") == "true" {
		return constants.ConfigFilename + "-e2e"
	}
	return constants.ConfigFilename
}

func WatchConfig(watcherCallback ReloadFn) {
	fmeViper.WatchConfig()
	fmeViper.OnConfigChange(func(e fsnotify.Event) {
		newCfg := loadConfig()
		watcherCallback(newCfg)
	})
}

func ConvertMaxAgeToInt(maxAgeStr string) int64 {
	maxAgeSecs, err := utils.ParseTimeRange(maxAgeStr)
	if err != nil {
		maxAgeWarning := fmt.Sprintf(strInvalidMaxAgeWarning, maxAgeStr)
		events.Events.Send(&eventtypes.AlertEvent{
			Msg:   maxAgeWarning,
			Level: eventtypes.Warning,
		})
		return 0
	}
	return maxAgeSecs
}

// validateAndUpdateConfiguration checks all configuration values and resets invalid ones to defaults.
// Warnings are logged directly via logger.Warn so they are visible during startup, even before
// any event bus listeners have registered. The event bus calls remain so that warnings also reach
// connected GUI/CLI clients when configuration is reloaded at runtime.
func validateAndUpdateConfiguration() {
	cfg := LoadConfiguration()

	validateAPIServerSettings()
	updated := validateGeneralSettings(&cfg)
	updated = validateTransferProfiles(&cfg) || updated

	if updated {
		if err := SaveConfig(&cfg); err != nil {
			logger.Fatal(strErrorUpdatingConfig, err)
		}
	}
}

// validateAPIServerSettings is used to set default values for API server settings if they are not set, since these values cannot be set
// through the GUI
func validateAPIServerSettings() {
	setAPIServerDefaultSettings(fmeViper)
}

func validateGeneralSettings(cfg *configtypes.FmeConfig) bool {
	changesRequired := false
	if cfg.General.RetryCount < 1 || cfg.General.RetryCount > constants.MaxRetryCount {
		changesRequired = true
		logger.Warn(strInvalidFieldValue, "max_retry_count", cfg.General.RetryCount, constants.DefaultRetryCount)
		events.Events.Warn(strInvalidFieldValue, "max_retry_count", cfg.General.RetryCount, constants.DefaultRetryCount)
		cfg.General.RetryCount = constants.DefaultRetryCount
	}

	cpuCores := systeminfo.GetCoreCount()
	if cfg.General.MaxActiveChecksums < 1 || cfg.General.MaxActiveChecksums > cpuCores {
		changesRequired = true
		logger.Warn(strInvalidFieldValue, "max_active_checksums", cfg.General.MaxActiveChecksums, max(cpuCores, 1))
		events.Events.Warn(strInvalidFieldValue, "max_active_checksums", cfg.General.MaxActiveChecksums, max(cpuCores, 1))
		cfg.General.MaxActiveChecksums = max(cpuCores, 1)
	}

	if cfg.General.MaxActiveTransfers < 1 {
		changesRequired = true
		logger.Warn(strInvalidFieldValue, "max_active_transfers",
			cfg.General.MaxActiveTransfers,
			constants.DefaultMaxActiveTransfers,
		)
		events.Events.Warn(strInvalidFieldValue, "max_active_transfers",
			cfg.General.MaxActiveTransfers,
			constants.DefaultMaxActiveTransfers,
		)
		cfg.General.MaxActiveTransfers = constants.DefaultMaxActiveTransfers
	}

	if cfg.General.TargetBandwidth < 0 {
		cfg.General.TargetBandwidth = 0
	}

	return changesRequired
}

//revive:disable:function-length

func validateTransferProfiles(cfg *configtypes.FmeConfig) bool {
	changesRequired := false
	for txProfileName := range maps.Keys(cfg.Protocols.S3.TransferProfiles) {
		txp := cfg.Protocols.S3.TransferProfiles[txProfileName]

		if txp.Region == "" {
			txp.Region = "us-east-2"
			changesRequired = true
		}

		if txp.Checksums.Algorithm == "" {
			txp.Checksums.Algorithm = constants.DefaultChecksumAlgorithm
			changesRequired = true
		}

		if txp.StorageClass == "" {
			txp.StorageClass = "standard"
			changesRequired = true
		}

		if txp.ChunkSize < constants.MinChunkSize {
			logger.Warn(strInvalidFieldValue, "chunk_size", txp.ChunkSize, constants.DefaultChunkSize)
			events.Events.Warn(strInvalidFieldValue, "chunk_size", txp.ChunkSize, constants.DefaultChunkSize)
			txp.ChunkSize = constants.DefaultChunkSize
			changesRequired = true
		}

		if txp.Threads < 1 {
			logger.Warn(strInvalidFieldValue, "threads", txp.Threads, constants.DefaultThreads)
			events.Events.Warn(strInvalidFieldValue, "threads", txp.Threads, constants.DefaultThreads)
			txp.Threads = constants.DefaultThreads
			changesRequired = true
		}

		if !utils.IsValidChecksumConfig(string(txp.Checksums.Algorithm), txp.Checksums.Enabled) {
			logger.Warn(strInvalidFieldValue, "checksums.algorithm", string(txp.Checksums.Algorithm), constants.DefaultChecksumAlgorithm)
			logger.Warn(strInvalidFieldValue, "checksums.enabled", txp.Checksums.Enabled, constants.DefaultChecksumEnabled)
			events.Events.Warn(strInvalidFieldValue, "checksums.algorithm", string(txp.Checksums.Algorithm), constants.DefaultChecksumAlgorithm)
			events.Events.Warn(strInvalidFieldValue, "checksums.enabled", txp.Checksums.Enabled, constants.DefaultChecksumEnabled)

			txp.Checksums.Algorithm = constants.DefaultChecksumAlgorithm
			txp.Checksums.Enabled = constants.DefaultChecksumEnabled

			changesRequired = true
		}

		changesRequired = validateChecksumConfig(&txp) || changesRequired

		if changesRequired {
			cfg.Protocols.S3.TransferProfiles[txProfileName] = txp
		}
	}

	for name := range maps.Keys(cfg.Protocols.S3.TransferProfiles) {
		txp := cfg.Protocols.S3.TransferProfiles[name]
		if txp.Threads < 1 {
			logger.Warn(strInvalidFieldValue, "threads", txp.Threads, constants.DefaultThreads)
			events.Events.Warn(strInvalidFieldValue, "threads", txp.Threads, constants.DefaultThreads)
			txp.Threads = constants.DefaultThreads
		}
		if changesRequired {
			cfg.Protocols.S3.TransferProfiles[name] = txp
		}
	}

	return changesRequired
}

func validateChecksumConfig(txp *configtypes.TransferProfile) bool {
	if !utils.IsValidChecksumConfig(string(txp.Checksums.Algorithm), txp.Checksums.Enabled) {
		logger.Warn(strInvalidFieldValue, "checksums.algorithm", string(txp.Checksums.Algorithm), constants.DefaultChecksumAlgorithm)
		logger.Warn(strInvalidFieldValue, "checksums.enabled", txp.Checksums.Enabled, constants.DefaultChecksumEnabled)
		events.Events.Warn(strInvalidFieldValue, "checksums.algorithm", string(txp.Checksums.Algorithm), constants.DefaultChecksumAlgorithm)
		events.Events.Warn(strInvalidFieldValue, "checksums.enabled", txp.Checksums.Enabled, constants.DefaultChecksumEnabled)

		txp.Checksums.Algorithm = constants.DefaultChecksumAlgorithm
		txp.Checksums.Enabled = constants.DefaultChecksumEnabled

		return true
	}

	return false
}

func createViper() *viper.Viper {
	tempViper := viper.New()
	tempViper.SetConfigName(GetConfigName())
	tempViper.SetConfigType(constants.ConfigFileExt)
	tempViper.AddConfigPath(GetConfigDir())

	return tempViper
}

//revive:enable:function-length
