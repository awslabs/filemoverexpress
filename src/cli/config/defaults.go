package config

import (
	"github.com/spf13/viper"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/utils/systeminfo"
)

func setGeneralDefaultSettings(instance *viper.Viper) {
	instance.SetDefault("general.max_active_checksums", systeminfo.GetCoreCount())
	instance.SetDefault("general.max_active_transfers", constants.DefaultMaxActiveTransfers)
	instance.SetDefault("general.no_sleep", false)
	instance.SetDefault("general.retry_count", constants.DefaultRetryCount)
	instance.SetDefault("general.target_bandwidth", 0)
}

func setLoggingDefaultSettings(instance *viper.Viper) {
	instance.SetDefault("logging.directory", "logs")
	instance.SetDefault("logging.severity", "info")
	instance.SetDefault("logging.max_size", constants.DefaultLoggingMaxSize)
	instance.SetDefault("logging.max_age", constants.DefaultLoggingMaxAge)
	instance.SetDefault("logging.compress", true)
}

func setReportingDefaultSettings(instance *viper.Viper) {
	instance.SetDefault("reports.directory", "reports")
}

func setS3DefaultSettings(instance *viper.Viper) {
	instance.SetDefault("protocols.s3.transfer_profiles", map[string]configtypes.TransferProfile{})
}

func setAPIServerDefaultSettings(instance *viper.Viper) {
	instance.SetDefault("api_server.allowed_origins", []string{})
	instance.SetDefault("api_server.enabled", true)
	instance.SetDefault("api_server.tls.enabled", false)
	instance.SetDefault("api_server.remote.enabled", false)
	instance.SetDefault("api_server.blocked_paths", getDefaultBlockedPaths())
	instance.SetDefault("api_server.permissions.allow_ui_configuration", false)
	instance.SetDefault("api_server.permissions.allow_local_rename_delete", false)
	instance.SetDefault("api_server.permissions.allow_remote_rename_delete", false)
}
