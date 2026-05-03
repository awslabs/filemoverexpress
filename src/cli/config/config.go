package config

import (
	"fmt"
	"maps"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"

	"github.com/knadh/koanf/parsers/yaml"
	"github.com/knadh/koanf/providers/confmap"
	"github.com/knadh/koanf/providers/file"
	"github.com/knadh/koanf/v2"
	"github.com/spf13/pflag"
	yamlv3 "gopkg.in/yaml.v3"

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
	configLock            = sync.Mutex{}
	boundFlags            = make(map[string]*pflag.Flag)
	fileProvider          *file.File
)

func buildDefaultsMap() map[string]interface{} {
	return map[string]interface{}{
		"general.maxActiveChecksums":                    systeminfo.GetCoreCount(),
		"general.maxActiveTransfers":                    constants.DefaultMaxActiveTransfers,
		"general.noSleep":                               constants.DefaultNoSleep,
		"general.retryCount":                            constants.DefaultRetryCount,
		"general.targetBandwidth":                       constants.DefaultTargetBandwidth,
		"logging.directory":                             constants.DefaultLoggingDirectory,
		"logging.severity":                              constants.DefaultLoggingSeverity,
		"logging.maxSize":                               constants.DefaultLoggingMaxSize,
		"logging.maxAge":                                constants.DefaultLoggingMaxAge,
		"logging.compress":                              constants.DefaultLoggingCompress,
		"reports.directory":                             constants.DefaultReportsDirectory,
		"protocols.s3.transferProfiles":                 map[string]interface{}{},
		"apiServer.allowedOrigins":                      []string{},
		"apiServer.enabled":                             constants.DefaultAPIServerEnabled,
		"apiServer.tls.enabled":                         constants.DefaultAPIServerTLSEnabled,
		"apiServer.remote.enabled":                      constants.DefaultAPIServerRemoteEnabled,
		"apiServer.blockedPaths":                        getDefaultBlockedPaths(),
		"apiServer.permissions.allowUIConfiguration":    constants.DefaultAllowUIConfiguration,
		"apiServer.permissions.allowLocalRenameDelete":  constants.DefaultAllowLocalRenameDelete,
		"apiServer.permissions.allowRemoteRenameDelete": constants.DefaultAllowRemoteRenameDelete,
	}
}

func initKoanf() {
	configPath := filepath.Join(GetConfigDir(), GetConfigName()+"."+constants.ConfigFileExt)
	fileProvider = file.Provider(configPath)

	LoadConfiguration()
}

func InitConfig() {
	configFile, configDir = setupConfigFileAndDirectory()
	initKoanf()
	createConfigIfNotExists(configFile)
	validateAndUpdateConfiguration()
}

// LoadConfiguration loads in values from the configuration file
func LoadConfiguration() configtypes.FmeConfig {
	if initialized {
		return cachedCfg.Load().(configtypes.FmeConfig)
	}

	return loadConfig()
}

func loadConfig() configtypes.FmeConfig {
	var loadedCfg configtypes.FmeConfig

	configLock.Lock()
	defer configLock.Unlock()

	k := koanf.New(".")

	if err := k.Load(confmap.Provider(buildDefaultsMap(), "."), nil); err != nil {
		logger.Fatal("Error loading default configuration: %v", err)
	}

	if fileProvider != nil {
		if err := k.Load(fileProvider, yaml.Parser()); err != nil {
			logger.Fatal(strUnableToLoadConfig, err)
		}
	}

	for key, flag := range boundFlags {
		if flag.Changed {
			_ = k.Load(confmap.Provider(map[string]interface{}{
				key: flag.Value.String(),
			}, "."), nil)
		}
	}

	if err := k.UnmarshalWithConf("", &loadedCfg, koanf.UnmarshalConf{
		Tag: "koanf",
	}); err != nil {
		logger.Fatal("Error parsing configuration file: %v", err)
	}

	loadedCfg = rekeyTransferProfilesByName(loadedCfg)
	cachedCfg.Store(loadedCfg)
	initialized = true

	return loadedCfg
}

func buildDefaultConfig() configtypes.FmeConfig {
	k := koanf.New(".")
	_ = k.Load(confmap.Provider(buildDefaultsMap(), "."), nil)
	var cfg configtypes.FmeConfig
	_ = k.UnmarshalWithConf("", &cfg, koanf.UnmarshalConf{Tag: "koanf"})
	return cfg
}

func marshalConfigToFile(cfg configtypes.FmeConfig, filePath string) error {
	data, err := yamlv3.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}
	if err := os.WriteFile(filePath, data, 0600); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}
	return nil
}

func SaveConfig(cfg *configtypes.FmeConfig) error {
	return marshalConfigToFile(*cfg, configFile)
}

func BindFlag(key string, flag *pflag.Flag) error {
	if flag == nil {
		return fmt.Errorf("flag is nil for key %s", key)
	}
	boundFlags[key] = flag
	return nil
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
	fileProvider.Watch(func(event interface{}, err error) {
		if err != nil {
			logger.Error("Config watch error: %v", err)
			return
		}
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

	updated := validateGeneralSettings(&cfg)
	updated = validateTransferProfiles(&cfg) || updated

	if updated {
		if err := SaveConfig(&cfg); err != nil {
			logger.Fatal(strErrorUpdatingConfig, err)
		}
	}
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

//revive:enable:function-length
