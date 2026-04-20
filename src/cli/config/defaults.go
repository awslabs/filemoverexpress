package config

import (
	"github.com/spf13/viper"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/utils/systeminfo"
)

func setGeneralDefaultSettings() {
	viper.SetDefault("general.max_active_checksums", systeminfo.GetCoreCount())
	viper.SetDefault("general.max_active_transfers", constants.DefaultMaxActiveTransfers)
	viper.SetDefault("general.no_sleep", false)
	viper.SetDefault("general.retry_count", constants.DefaultRetryCount)
	viper.SetDefault("general.target_bandwidth", 0)
}

func setLoggingDefaultSettings() {
	viper.SetDefault("logging.directory", "logs")
	viper.SetDefault("logging.severity", "info")
	viper.SetDefault("logging.max_size", constants.DefaultLoggingMaxSize)
	viper.SetDefault("logging.max_age", constants.DefaultLoggingMaxAge)
	viper.SetDefault("logging.compress", true)
}

func setReportingDefaultSettings() {
	viper.SetDefault("reports.directory", "reports")
}

func setS3DefaultSettings() {
	viper.SetDefault("protocols.s3.transfer_profiles", map[string]configtypes.TransferProfile{})
}

func setAPIServerDefaultSettings() {
	viper.SetDefault("api_server.enabled", true)
	viper.SetDefault("api_server.tls.enabled", false)
	viper.SetDefault("api_server.remote.enabled", false)
	viper.SetDefault("api_server.blocked_paths", getDefaultBlockedPaths())
	viper.SetDefault("api_server.permissions.allow_ui_configuration", false)
	viper.SetDefault("api_server.permissions.allow_local_rename_delete", false)
	viper.SetDefault("api_server.permissions.allow_remote_rename_delete", false)
}
