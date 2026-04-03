package config

import (
    "fmt"
    "os"
    "regexp"
    "slices"
    "strings"

    "github.com/fsnotify/fsnotify"
    "github.com/spf13/viper"

    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/events"
    "github.com/awslabs/filemoverexpress/logger"
    "github.com/awslabs/filemoverexpress/types/configtypes"
    "github.com/awslabs/filemoverexpress/types/eventtypes"
    "github.com/awslabs/filemoverexpress/utils"
    "github.com/awslabs/filemoverexpress/utils/systeminfo"
)

const (
    // empty string is valid key, but we never expect our config to have this key
    unexpectedViperConfigKey = ""
)

var configFile, configDir string

// init validates the user's configuration environment, and sets up the default values for all config file options
func init() {
    configFile, configDir = setupConfigFileAndDirectory()

    migrateOldConfigurationValues()
    InitConfig()
    ValidateAndUpdateConfiguration()
}

func initViper() {
    viper.SetConfigName(GetConfigName())
    viper.SetConfigType(constants.ConfigFileExt)
    viper.AddConfigPath(configDir)
}

func InitConfig() {
    initViper()

    setGeneralDefaultSettings()
    setLoggingDefaultSettings()
    setReportingDefaultSettings()
    setS3DefaultSettings()
    setAPIServerDefaultSettings()

    createConfigIfNotExists(configFile)
}

func migrateOldConfigurationValues() {
    _, err := os.Stat(configFile)
    if os.IsNotExist(err) {
        return
    }

    oldKeysToNewKeys := make(map[string]string)
    oldKeysToNewKeys["api_server.allow_ui_configuration"] = "api_server.permissions.allow_ui_configuration"

    configtypes.ViperLock.Lock()
    defer configtypes.ViperLock.Unlock()

    // temporary viper instance used just for migration (so aliases aren't stored)
    migrationViper := viper.New()
    migrationViper.SetConfigName(GetConfigName())
    migrationViper.SetConfigType(constants.ConfigFileExt)
    migrationViper.AddConfigPath(configDir)

    if err = migrationViper.ReadInConfig(); err != nil {
        logger.Fatal(strUnableToLoadConfig, err)
    }

    nonExistentConfigKey := getNonExistentConfigKey(migrationViper.AllKeys())

    for oldKey, newKey := range oldKeysToNewKeys {
        if migrationViper.IsSet(oldKey) {
            oldValue := migrationViper.Get(oldKey)
            // remove the old key value pair from the config file
            migrationViper.RegisterAlias(oldKey, nonExistentConfigKey)
            err = migrationViper.WriteConfig()
            if err != nil {
                logger.Fatal(strErrorUpdatingConfig, err)
            }
            // migrate old value to new key if new key is not set
            if !migrationViper.IsSet(newKey) {
                viper.Set(newKey, oldValue)
                err = viper.WriteConfig()
                if err != nil {
                    logger.Fatal(strErrorUpdatingConfig, err)
                }
            }
        }
    }
}

// getNonExistentConfigKey returns a config key guaranteed to not exist in the viper instance
func getNonExistentConfigKey(existingKeys []string) string {
    if !slices.Contains(existingKeys, unexpectedViperConfigKey) {
        return unexpectedViperConfigKey
    }
    // generate new unique key
    longestKey := ""
    for _, key := range existingKeys {
        if len(key) > len(longestKey) {
            longestKey = key
        }
    }
    // add a string that is unexpected to be part of a new valid key
    return longestKey + "a3dm"
}

// LoadConfiguration loads in values from the configuration file
func LoadConfiguration() (configtypes.FmeConfig, error) {
    var cfg configtypes.FmeConfig

    configtypes.ViperLock.Lock()
    defer configtypes.ViperLock.Unlock()
    if err := viper.ReadInConfig(); err != nil {
        return cfg, err
    }

    err := viper.Unmarshal(&cfg)
    if err != nil {
        return cfg, err
    }

    cfg = rekeyTransferProfilesByName(cfg)

    return cfg, nil
}

func rekeyTransferProfilesByName(cfg configtypes.FmeConfig) configtypes.FmeConfig {
    for k, v := range cfg.Protocols.S3.TransferProfiles {
        v.Name = k
        cfg.Protocols.S3.TransferProfiles[k] = v
    }
    return cfg
}

// CheckS3ProtocolValue ensures the correct config or default value is returned
func CheckS3ProtocolValue(key string) int {
    v := viper.GetInt(key)
    if v == 0 {
        s := strings.TrimPrefix(key, "protocols.s3.")
        return constants.ConfigDefaults[s]
    }

    return v
}

// GetConfigName returns the name of the config file
func GetConfigName() string {
    if os.Getenv("FME_E2E") == "true" {
        return constants.ConfigFilename + "-e2e"
    }
    return constants.ConfigFilename
}

func WatchConfig(reload func(e fsnotify.Event)) {
    configtypes.ViperLock.Lock()
    defer configtypes.ViperLock.Unlock()

    viper.WatchConfig()
    viper.OnConfigChange(reload)
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

func GetFilterValue() *regexp.Regexp {
    var filterRgx *regexp.Regexp
    f := viper.GetString("protocols.s3.filter")
    if f != "" {
        var err error
        filterRgx, err = regexp.Compile(f)
        if err != nil {
            var emptyRgx *regexp.Regexp
            events.Events.Error(strInvalidFilterExpr, err)
            return emptyRgx
        }
    }
    return filterRgx
}

// ValidateAndUpdateConfiguration checks all configuration values and resets invalid ones to defaults.
// Warnings are logged directly via logger.Warn so they are visible during startup, even before
// any event bus listeners have registered. The event bus calls remain so that warnings also reach
// connected GUI/CLI clients when configuration is reloaded at runtime.
func ValidateAndUpdateConfiguration() {
    cfg, err := LoadConfiguration()
    if err != nil {
        logger.Fatal(strUnableToLoadConfig, err)
    }
    configtypes.ViperLock.Lock()
    defer configtypes.ViperLock.Unlock()

    validateAPIServerSettings()
    validateGeneralSettings(&cfg)
    validateTransferProfiles(&cfg)

    err = viper.WriteConfig()
    if err != nil {
        logger.Fatal(strErrorUpdatingConfig, err)
    }
}

// validateAPIServerSettings is used to set default values for API server settings if they are not set, since these values cannot be set
// through the GUI
func validateAPIServerSettings() {
    setAPIServerDefaultSettings()
}

func validateGeneralSettings(cfg *configtypes.FmeConfig) bool {
    changesRequired := false
    if cfg.General.RetryCount < 1 || cfg.General.RetryCount > constants.MaxRetryCount {
        changesRequired = true
        logger.Warn(strInvalidFieldValue, "max_retry_count", cfg.General.RetryCount, constants.DefaultRetryCount)
        events.Events.Warn(strInvalidFieldValue, "max_retry_count", cfg.General.RetryCount, constants.DefaultRetryCount)
        viper.Set("general.retry_count", constants.DefaultRetryCount)
    }

    cpuCores := systeminfo.GetCoreCount()
    if cfg.General.MaxActiveChecksums < 1 || cfg.General.MaxActiveChecksums > cpuCores {
        changesRequired = true
        logger.Warn(strInvalidFieldValue, "max_active_checksums", cfg.General.MaxActiveChecksums, max(cpuCores, 1))
        events.Events.Warn(strInvalidFieldValue, "max_active_checksums", cfg.General.MaxActiveChecksums, max(cpuCores, 1))
        viper.Set("general.max_active_checksums", max(cpuCores, 1))
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
        viper.Set("general.max_active_transfers", constants.DefaultMaxActiveTransfers)
    }

    if cfg.General.TargetBandwidth < 0 {
        viper.Set("general.target_bandwidth", 0)
    }

    return changesRequired
}

//revive:disable:function-length

func validateTransferProfiles(cfg *configtypes.FmeConfig) bool {
    changesRequired := false
    transferProfileFields := make(map[string]any)
    transferProfileFields["auto_tuning"] = true
    transferProfileFields["region"] = "us-west2"
    transferProfileFields["name"] = ""
    transferProfileFields["bucket"] = ""
    transferProfileFields["profile"] = ""
    transferProfileFields["endpoint"] = ""
    transferProfileFields["filter"] = ""
    transferProfileFields["checksums.enabled"] = false
    transferProfileFields["checksums.algorithm"] = constants.DefaultChecksumAlgorithm
    transferProfileFields["chunk_size"] = constants.DefaultChunkSize
    transferProfileFields["threads"] = constants.DefaultThreads
    transferProfileFields["max_age"] = ""
    transferProfileFields["accelerated"] = false
    transferProfileFields["file_order"] = []string{}
    transferProfileFields["enable_metadata_filter"] = true
    transferProfileFields["storage_class"] = "standard"
    transferProfileFields["paths.local"] = ""
    transferProfileFields["paths.remote"] = ""

    for txProfileName := range cfg.Protocols.S3.TransferProfiles {
        configPath := strings.Join([]string{"protocols.s3.transfer_profiles", txProfileName}, ".")
        for field, defaultValue := range transferProfileFields {
            fieldPath := strings.Join([]string{configPath, field}, ".")
            if !viper.IsSet(fieldPath) {
                changesRequired = true
                viper.Set(fieldPath, defaultValue)
            } else {
                viper.Set(fieldPath, viper.Get(fieldPath))
            }
        }
    }

    for txProfileName := range cfg.Protocols.S3.TransferProfiles {
        configPath := strings.Join([]string{"protocols.s3.transfer_profiles", txProfileName}, ".")

        changesRequired = validateChunkSize(configPath, changesRequired)
        changesRequired = validateThreads(configPath, changesRequired)
        changesRequired = validateChecksumConfig(configPath, changesRequired)
    }

    return changesRequired
}

func validateChecksumConfig(configPath string, changesRequired bool) bool {
    checksumsPath := strings.Join([]string{configPath, "checksums"}, ".")
    checksumAlgorithmPath := strings.Join([]string{configPath, "checksums", "algorithm"}, ".")
    checksumEnabledPath := strings.Join([]string{configPath, "checksums", "enabled"}, ".")
    if viper.IsSet(checksumsPath) {
        configuredChecksumAlgorithm, validAlgorithmType := viper.Get(checksumAlgorithmPath).(string)
        configuredChecksumEnabled, validEnabledType := viper.Get(checksumEnabledPath).(bool)

        if !validAlgorithmType || !validEnabledType || !utils.IsValidChecksumConfig(configuredChecksumAlgorithm,
            configuredChecksumEnabled) {
            logger.Warn(strInvalidFieldValue, "checksums.algorithm", configuredChecksumAlgorithm,
                constants.DefaultChecksumAlgorithm)
            logger.Warn(strInvalidFieldValue, "checksums.enabled", configuredChecksumEnabled,
                constants.DefaultChecksumEnabled)
            events.Events.Warn(strInvalidFieldValue, "checksums.algorithm", configuredChecksumAlgorithm,
                constants.DefaultChecksumAlgorithm)
            events.Events.Warn(strInvalidFieldValue, "checksums.enabled", configuredChecksumEnabled,
                constants.DefaultChecksumEnabled)
            changesRequired = true
            viper.Set(checksumAlgorithmPath, constants.DefaultChecksumAlgorithm)
            viper.Set(checksumEnabledPath, constants.DefaultChecksumEnabled)
        }
    }
    return changesRequired
}

func validateThreads(configPath string, changesRequired bool) bool {
    threadsPath := strings.Join([]string{configPath, "threads"}, ".")
    if viper.IsSet(threadsPath) {
        configuredThreads, validType := viper.Get(threadsPath).(int)
        if !validType || configuredThreads < 1 {
            logger.Warn(strInvalidFieldValue, "threads", configuredThreads, constants.DefaultThreads)
            events.Events.Warn(strInvalidFieldValue, "threads", configuredThreads, constants.DefaultThreads)
            changesRequired = true
            viper.Set(threadsPath, constants.DefaultThreads)
        }
    }
    return changesRequired
}

func validateChunkSize(configPath string, changesRequired bool) bool {
    chunkSizePath := strings.Join([]string{configPath, "chunk_size"}, ".")
    if viper.IsSet(chunkSizePath) {
        configuredChunkSize, validType := viper.Get(chunkSizePath).(int)
        if !validType || configuredChunkSize < constants.MinChunkSize {
            logger.Warn(strInvalidFieldValue, "chunk_size", configuredChunkSize, constants.DefaultChunkSize)
            events.Events.Warn(strInvalidFieldValue, "chunk_size", configuredChunkSize, constants.DefaultChunkSize)
            changesRequired = true
            viper.Set(chunkSizePath, constants.DefaultChunkSize)
        }
    }
    return changesRequired
}

//revive:enable:function-length
