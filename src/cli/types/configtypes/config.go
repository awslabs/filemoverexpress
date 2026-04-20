package configtypes

import (
	"errors"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"sync"

	"github.com/spf13/viper"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/utils/safeconv"
)

var ViperLock sync.Mutex

// revive:disable:max-public-structs
type (
	FmeConfig struct {
		General          General
		Logging          Logging   `mapstructure:"logging" yaml:"logging"`
		Reports          Reports   `mapstructure:"reports" yaml:"reports"`
		APIServer        APIServer `mapstructure:"api_server"`
		Protocols        ProtocolList
		UploadHotFolders []UploadHotFolderSettings `mapstructure:"hot_folders"`
	}
	General struct {
		NoSleep            bool   `mapstructure:"no_sleep"`
		RetryCount         uint32 `mapstructure:"retry_count"`
		MaxActiveChecksums int32  `mapstructure:"max_active_checksums"`
		MaxActiveTransfers int32  `mapstructure:"max_active_transfers"`
		TargetBandwidth    int32  `mapstructure:"target_bandwidth"`
	}
	Logging struct {
		Directory string `mapstructure:"directory" yaml:"directory"`
		Severity  string `mapstructure:"severity" yaml:"severity"`
		MaxSize   int    `mapstructure:"max_size" yaml:"max_size"`
		MaxAge    int    `mapstructure:"max_age" yaml:"max_age"`
		Compress  bool   `mapstructure:"compress" yaml:"compress"`
	}
	Reports struct {
		Directory string `mapstructure:"directory" yaml:"directory"`
	}
	APIServer struct {
		Enabled         bool
		TLSSettings     APIServerTLSSettings        `mapstructure:"tls" yaml:"tls"`
		RemoteSettings  APIServerRemoteSettings     `mapstructure:"remote" yaml:"remote"`
		BlockedPathList []string                    `mapstructure:"blocked_paths" yaml:"blocked_paths"`
		AllowedOrigins  []string                    `mapstructure:"allowed_origins" yaml:"allowed_origins"`
		Permissions     APIServerPermissionSettings `mapstructure:"permissions" yaml:"permissions"`
	}
	APIServerRemoteSettings struct {
		Enabled      bool
		PreSharedKey string `mapstructure:"key" yaml:"key"`
		Ports        []uint32
		Address      string
	}
	APIServerTLSSettings struct {
		Enabled         bool   `mapstructure:"enabled" yaml:"enabled"`
		CertificateFile string `mapstructure:"certificate_file" yaml:"certificate_file"`
		KeyFile         string `mapstructure:"key_file" yaml:"key_file"`
	}
	APIServerPermissionSettings struct {
		AllowUIConfiguration    bool `mapstructure:"allow_ui_configuration" yaml:"allow_ui_configuration"`
		AllowLocalRenameDelete  bool `mapstructure:"allow_local_rename_delete" yaml:"allow_local_rename_delete"`
		AllowRemoteRenameDelete bool `mapstructure:"allow_remote_rename_delete" yaml:"allow_remote_rename_delete"`
	}
	ProtocolList struct {
		S3 S3ProtocolConfig
	}
	TransferProfile struct {
		Name     string
		Bucket   string
		Region   string
		Profile  string
		Endpoint string

		Filter     string
		AutoTuning bool             `mapstructure:"auto_tuning" yaml:"auto_tuning"`
		Checksums  ChecksumSettings `mapstructure:"checksums" yaml:"checksums"`
		ChunkSize  int32            `mapstructure:"chunk_size" yaml:"chunk_size"`
		Threads    int
		MaxAge     string `mapstructure:"max_age" yaml:"max_age"`

		Accelerated bool
		FileOrder   []string `mapstructure:"file_order" yaml:"file_order"`

		EnableMetadataFilter bool   `mapstructure:"enable_metadata_filter" yaml:"enable_metadata_filter"`
		StorageClass         string `mapstructure:"storage_class" yaml:"storage_class"`

		Paths PathsSettings `mapstructure:"paths" yaml:"paths"`
	}
	ChecksumSettings struct {
		Enabled   bool                        `mapstructure:"enabled" yaml:"enabled"`
		Algorithm constants.ChecksumAlgorithm `mapstructure:"algorithm" yaml:"algorithm"`
	}
	UploadHotFolderSettings struct {
		Enabled              bool
		LocalSourceFolder    string                          `mapstructure:"local_source_folder" yaml:"local_source_folder"`
		Name                 string                          `mapstructure:"name" yaml:"name"`
		RemoteConfigurations []HotFolderRemoteConfigurations `mapstructure:"remote_configurations" yaml:"remote_configurations"`
	}
	HotFolderRemoteConfigurations struct {
		RemoteConfigurationName string `mapstructure:"remote_configuration_name" yaml:"remote_configuration_name"`
		S3DestinationFolder     string `mapstructure:"s3_destination_folder" yaml:"s3_destination_folder"`
	}
	PathsSettings struct {
		Local  string `mapstructure:"local" yaml:"local"`
		Remote string `mapstructure:"remote" yaml:"remote"`
	}
	S3ProtocolConfig struct {
		TransferProfiles map[string]TransferProfile `mapstructure:"transfer_profiles" yaml:"transfer_profiles"`
	}
)

// String returns a string format of the provided TransferProfile struct, including all of its properties
func (v *TransferProfile) String() string {
	var out []string
	e := reflect.ValueOf(v).Elem()

	for i := 0; i < e.NumField(); i++ {
		out = append(out, fmt.Sprintf("    %s: %v", e.Type().Field(i).Name, e.Field(i).Interface()))
	}

	sort.Strings(out)
	return strings.Join(out, "\n")
}

func (nc FmeConfig) GetTransferProfile(profileName string) (TransferProfile, error) {
	for name, transferProfile := range nc.Protocols.S3.TransferProfiles {
		if name == profileName {
			return transferProfile, nil
		}
	}

	return TransferProfile{}, errors.New(strNoSuchTransferProfile + profileName)
}

func (nc FmeConfig) ToProtobuf() *fmev1.FmeConfig {
	transferProfiles := TransferProfilesToProtobuf(nc.Protocols.S3.TransferProfiles)
	uploadHotFolders := HotFoldersToProtobuf(nc.UploadHotFolders)

	// Safe conversion for logging settings - Issues #12, #13
	maxSize, err := safeconv.IntToInt32(nc.Logging.MaxSize)
	if err != nil {
		logger.Error("Invalid MaxSize value %d: %v, using default", nc.Logging.MaxSize, err)
		maxSize = 100 // Default max size in MB
	}

	maxAge, err := safeconv.IntToInt32(nc.Logging.MaxAge)
	if err != nil {
		logger.Error("Invalid MaxAge value %d: %v, using default", nc.Logging.MaxAge, err)
		maxAge = 28 // Default max age in days
	}

	return &fmev1.FmeConfig{
		General: &fmev1.GeneralSettings{
			NoSleep:            nc.General.NoSleep,
			RetryCount:         nc.General.RetryCount,
			MaxActiveTransfers: nc.General.MaxActiveTransfers,
			MaxActiveChecksums: nc.General.MaxActiveChecksums,
			TargetBandwidth:    nc.General.TargetBandwidth,
		},
		Logging: &fmev1.LoggingSettings{
			Directory: nc.Logging.Directory,
			Severity:  nc.Logging.Severity,
			MaxSize:   maxSize,
			MaxAge:    maxAge,
			Compress:  nc.Logging.Compress,
		},
		Reports: &fmev1.ReportsSettings{
			Directory: nc.Reports.Directory,
		},
		ApiServer: &fmev1.ApiServerSettings{
			Enabled: nc.APIServer.Enabled,
			Tls: &fmev1.ApiServerTlsSettings{
				Enabled:         nc.APIServer.TLSSettings.Enabled,
				CertificateFile: nc.APIServer.TLSSettings.CertificateFile,
				KeyFile:         nc.APIServer.TLSSettings.KeyFile,
			},
			Remote: &fmev1.ApiServerRemoteSettings{
				Enabled:      nc.APIServer.RemoteSettings.Enabled,
				PreSharedKey: nc.APIServer.RemoteSettings.PreSharedKey,
				Address:      nc.APIServer.RemoteSettings.Address,
				Ports:        nc.APIServer.RemoteSettings.Ports,
			},
		},
		Protocols: &fmev1.Protocols{
			S3: &fmev1.S3Settings{
				TransferProfiles: transferProfiles,
			},
		},
		UploadHotFolders: uploadHotFolders,
	}
}

func (nc FmeConfig) GRPCUpdate(pbc *fmev1.FmeConfig) error {
	ViperLock.Lock()
	defer ViperLock.Unlock()

	nc.saveGeneralSettings(pbc.General)
	nc.saveLoggingSettings(pbc.Logging)
	nc.saveReportSettings(pbc.Reports)
	nc.saveS3Settings(pbc.Protocols.S3)
	nc.saveHotFolderSettings(pbc.UploadHotFolders)

	err := viper.WriteConfig()
	if err != nil {
		events.Events.Error(strErrorWritingConfig, err.Error())
	}

	return err
}

func (FmeConfig) saveGeneralSettings(settings *fmev1.GeneralSettings) {
	viper.Set("general.no_sleep", settings.NoSleep)
	viper.Set("general.retry_count", settings.RetryCount)
	viper.Set("general.max_active_transfers", settings.MaxActiveTransfers)
	viper.Set("general.max_active_checksums", settings.MaxActiveChecksums)
	viper.Set("general.target_bandwidth", settings.TargetBandwidth)
}

func (FmeConfig) saveLoggingSettings(settings *fmev1.LoggingSettings) {
	viper.Set("logging.directory", settings.Directory)
	viper.Set("logging.severity", settings.Severity)
	viper.Set("logging.max_size", settings.MaxSize)
	viper.Set("logging.max_age", settings.MaxAge)
	viper.Set("logging.compress", settings.Compress)
}

func (FmeConfig) saveReportSettings(settings *fmev1.ReportsSettings) {
	viper.Set("reports.directory", settings.Directory)
}

func (FmeConfig) saveS3Settings(settings *fmev1.S3Settings) {
	transferProfiles := transferProfilesFromProtobuf(settings.TransferProfiles)
	viper.Set("protocols.s3.transfer_profiles", transferProfiles)
}

func (FmeConfig) saveHotFolderSettings(settings []*fmev1.UploadHotFolderSettings) {
	hotFolders := hotFoldersFromProtobuf(settings)
	viper.Set("hot_folders", hotFolders)
}

func transferProfilesFromProtobuf(profileList map[string]*fmev1.TransferProfile) (transferProfiles map[string]TransferProfile) {
	transferProfiles = make(map[string]TransferProfile)

	for name, transferProfile := range profileList {
		vdr := TransferProfile{
			Name:                 transferProfile.Name,
			Bucket:               transferProfile.Bucket,
			Region:               transferProfile.Region,
			Profile:              transferProfile.Profile,
			Endpoint:             transferProfile.Endpoint,
			Accelerated:          transferProfile.Accelerated,
			FileOrder:            transferProfile.FileOrder,
			EnableMetadataFilter: transferProfile.EnableMetadataFilter,
			StorageClass:         transferProfile.StorageClass,
			Paths: PathsSettings{
				Local:  transferProfile.Paths.Local,
				Remote: transferProfile.Paths.Remote,
			},
			AutoTuning: transferProfile.AutoTuning,
			Checksums: ChecksumSettings{
				Enabled:   transferProfile.Checksums.Enabled,
				Algorithm: constants.ChecksumAlgorithm(transferProfile.Checksums.Algorithm),
			},
			ChunkSize: transferProfile.ChunkSize,
			Filter:    transferProfile.Filter,
			Threads:   int(transferProfile.Threads),
			MaxAge:    transferProfile.MaxAge,
		}

		transferProfiles[name] = vdr
	}

	return transferProfiles
}

func TransferProfilesToProtobuf(transferProfiles map[string]TransferProfile) map[string]*fmev1.TransferProfile {
	out := make(map[string]*fmev1.TransferProfile)

	for name, transferProfile := range transferProfiles {
		// Safe conversion for threads - Issue #11
		threads, err := safeconv.IntToInt32(transferProfile.Threads)
		if err != nil {
			logger.Error("Invalid Threads value %d for profile '%s': %v, using default", transferProfile.Threads, name, err)
			threads = 1 // Default thread count
		}

		pbv := &fmev1.TransferProfile{
			Name:                 transferProfile.Name,
			Bucket:               transferProfile.Bucket,
			Region:               transferProfile.Region,
			Profile:              transferProfile.Profile,
			Endpoint:             transferProfile.Endpoint,
			Accelerated:          transferProfile.Accelerated,
			FileOrder:            transferProfile.FileOrder,
			EnableMetadataFilter: transferProfile.EnableMetadataFilter,
			StorageClass:         transferProfile.StorageClass,
			Paths: &fmev1.PathsSettings{
				Local:  transferProfile.Paths.Local,
				Remote: transferProfile.Paths.Remote,
			},
			AutoTuning: transferProfile.AutoTuning,
			Checksums: &fmev1.ChecksumSettings{
				Enabled:   transferProfile.Checksums.Enabled,
				Algorithm: string(transferProfile.Checksums.Algorithm),
			},
			ChunkSize: transferProfile.ChunkSize,
			Filter:    transferProfile.Filter,
			Threads:   threads,
			MaxAge:    transferProfile.MaxAge,
		}
		out[name] = pbv
	}

	return out
}

func hotFoldersFromProtobuf(hotFoldersList []*fmev1.UploadHotFolderSettings) (hotFolders []UploadHotFolderSettings) {
	for _, hotFolder := range hotFoldersList {
		var txs []HotFolderRemoteConfigurations
		for _, tx := range hotFolder.RemoteConfigurations {
			transferConfiguration := HotFolderRemoteConfigurations{
				RemoteConfigurationName: tx.RemoteConfigurationName,
				S3DestinationFolder:     tx.S3DestinationFolder,
			}
			txs = append(txs, transferConfiguration)
		}
		hotFolderFromProtobuf := UploadHotFolderSettings{
			Name:                 hotFolder.Name,
			Enabled:              hotFolder.Enabled,
			LocalSourceFolder:    hotFolder.LocalSourceFolder,
			RemoteConfigurations: txs,
		}
		hotFolders = append(hotFolders, hotFolderFromProtobuf)
	}

	return hotFolders
}

func HotFoldersToProtobuf(hotFolders []UploadHotFolderSettings) []*fmev1.UploadHotFolderSettings {
	var out []*fmev1.UploadHotFolderSettings
	for _, hotFolder := range hotFolders {
		var txs []*fmev1.HotFolderTransferConfigurations
		for _, tx := range hotFolder.RemoteConfigurations {
			pbv := &fmev1.HotFolderTransferConfigurations{
				RemoteConfigurationName: tx.RemoteConfigurationName,
				S3DestinationFolder:     tx.S3DestinationFolder,
			}
			txs = append(txs, pbv)
		}
		pbv := &fmev1.UploadHotFolderSettings{
			Enabled:              hotFolder.Enabled,
			LocalSourceFolder:    hotFolder.LocalSourceFolder,
			Name:                 hotFolder.Name,
			RemoteConfigurations: txs,
		}
		out = append(out, pbv)
	}

	return out
}
