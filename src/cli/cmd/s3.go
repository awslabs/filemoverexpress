package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/awslabs/filemoverexpress/cmd/clitools"
	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/core/download"
	transferapi "github.com/awslabs/filemoverexpress/core/transfer-api"
	"github.com/awslabs/filemoverexpress/core/transferstats"
	"github.com/awslabs/filemoverexpress/core/upload"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/globals"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/service"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/transfertypes"
	"github.com/awslabs/filemoverexpress/utils"
	"github.com/awslabs/filemoverexpress/utils/errs"
	"github.com/awslabs/filemoverexpress/utils/fs"
	"github.com/awslabs/filemoverexpress/utils/supportfile"
)

const (
	MinUploadArgs   = 2
	MinDownloadArgs = 3
)

var (
	uploadCmd = &cobra.Command{
		Use:    strS3UploadUse,
		Short:  strS3UploadHelp,
		Long:   strS3UploadHelp,
		Run:    uploadFile,
		Args:   uploadArgsCheck,
		PreRun: bindConfigsToFlags,
	}

	downloadCmd = &cobra.Command{
		Use:    strS3DownloadUse,
		Short:  strS3DownloadHelp,
		Long:   strS3DownloadHelp,
		Run:    downloadObject,
		Args:   downloadArgsCheck,
		PreRun: bindConfigsToFlags,
	}

	validateCredentialsCmd = &cobra.Command{
		Use:   strS3ValidateCredentialsUse,
		Short: strS3ValidateCredentialsShortHelp,
		Long:  strS3ValidateCredentialsLongHelp,
		Run:   validateCredentials,
		Args:  cobra.ExactArgs(1),
	}

	profileName          string
	threads              int
	chunkSize            int64
	maxAge               string
	filter               string
	maxActiveTransfers   int32
	force                bool
	maxActiveChecksums   int
	checksumAlgorithm    string
	retryCount           uint64
	enableMetadataFilter bool
	prefix               string
	autoTuning           bool
)

func init() {
	setupFlags()

	rootCmd.AddCommand(uploadCmd)
	rootCmd.AddCommand(downloadCmd)
	rootCmd.AddCommand(validateCredentialsCmd)
}

func setupFlags() {
	setUploadFlags(uploadCmd)
	setDownloadFlags(downloadCmd)
}

//revive:disable:function-length
func setSharedFlags(command *cobra.Command) {
	pFlags := command.PersistentFlags()
	pFlags.StringVar(&profileName, "profile", "", strS3ProfileUsage)
	pFlags.IntVar(&threads, "threads", constants.DefaultThreads, strS3ThreadUsage)
	pFlags.Int64Var(&chunkSize, "chunk-size", int64(constants.DefaultChunkSize), strS3ChunkSizeUsage)
	pFlags.StringVar(&maxAge, "max-age", "0", strS3MaxAgeUsage)
	pFlags.StringVar(&filter, "filter", "", strS3FilterUsage)
	pFlags.Int32Var(&maxActiveTransfers, "max-active-transfers", 0, strS3MaxActiveTransfersUsage)
	pFlags.BoolVar(&force, "force", false, strS3ForceUsage)
	pFlags.StringVar(&checksumAlgorithm, "checksum-algorithm", "md5", strS3ChecksumAlgorithmUsage)
	pFlags.Uint64Var(&retryCount, "retry-count", constants.DefaultRetryCount, strS3RetryCountUsage)
	pFlags.BoolVar(&enableMetadataFilter, "enable-metadata-filter", false,
		strS3EnableMetadataFilterUsage,
	)
	pFlags.StringVar(&prefix, "prefix", "", strS3PrefixUsage)
	pFlags.BoolVar(&autoTuning, "auto-tuning", false, strS3AutoTuningUsage)
}

//revive:enable:function-length

func setUploadFlags(command *cobra.Command) {
	setSharedFlags(command)
	pFlags := command.PersistentFlags()
	pFlags.IntVar(&maxActiveChecksums, "max-active-checksums", 1, strS3MaxActiveChecksumsUsage)
}

func setDownloadFlags(command *cobra.Command) {
	setSharedFlags(command)
}

func bindConfigsToFlags(command *cobra.Command, _ []string) {
	flags := map[string]string{
		"protocols.s3.threads":           "threads",
		"protocols.s3.chunkSize":         "chunk-size",
		"protocols.s3.maxAge":            "max-age",
		"protocols.s3.filter":            "filter",
		"general.maxActiveTransfers":     "max-active-transfers",
		"general.maxActiveChecksums":     "max-active-checksums",
		"protocols.s3.checksumAlgorithm": "checksum-algorithm",
		"general.retryCount":             "retry-count",
		"apiServer.remote.address":       "address",
	}

	// bind flags for each command
	for pflag, opt := range flags {
		// bind flag if exists
		if flag := command.PersistentFlags().Lookup(opt); flag != nil {
			err := config.BindFlag(pflag, flag)

			if err != nil {
				events.Events.Fatal(strS3FailedBindingFlags, err)
			}
		}
	}
}

//revive:disable:function-length
func uploadFile(cmd *cobra.Command, args []string) {
	fileMoverCommandInit()

	transferProfileName, sources := parseUploadCommandArgs(args)
	forceFlag := getForceFlag(cmd)
	txProfile, err := config.LoadConfiguration().GetTransferProfile(transferProfileName)
	if err != nil {
		events.Events.Error("error retrieving transfer profile %s: %v", transferProfileName, err)
		return
	}
	prefixValue, err := cmd.Flags().GetString("prefix")
	if err != nil {
		events.Events.Warn("unable to retrieve prefix value: %v", err)
	}
	warnIfMaxFilesTooLow()

	// Set upload path to be absolute if it is not already
	var basePath string
	basePathForAbsolute := fs.LongestCommonDirectories(sources)
	hasAbsolutePaths := false
	hasRelativePaths := false

	for idx := range sources {
		if strings.Contains(sources[idx], ".."+string(filepath.Separator)) || strings.HasSuffix(sources[idx], "..") {
			events.Events.Fatal(strUnsupportedCharInPath, "..")
		}

		sources[idx] = strings.TrimSuffix(sources[idx], string(filepath.Separator))
		if filepath.IsAbs(sources[idx]) {
			hasAbsolutePaths = true
			sources[idx] = strings.TrimPrefix(sources[idx], basePathForAbsolute)
		} else {
			hasRelativePaths = true
			currentDir, err := os.Getwd()
			if err != nil {
				events.Events.Fatal(strErrorGettingDir, sources[idx], err)
			}
			basePath = currentDir + string(filepath.Separator)
		}

		sources[idx] = strings.TrimPrefix(sources[idx], string(filepath.Separator))
	}
	if hasRelativePaths && hasAbsolutePaths {
		events.Events.Fatal(strMustBeAbsoluteOrRelative)
	}
	if hasAbsolutePaths {
		basePath = basePathForAbsolute
	}

	var jobName string
	if len(sources) > 0 {
		jobName += sources[0]
	}
	if len(sources) > 1 {
		jobName += " & others"
	}
	job, err := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
		Direction:       transfertypes.Upload,
		Name:            jobName,
		TransferProfile: &txProfile,
		Sources:         sources,
		Destination:     prefixValue,
		Force:           forceFlag,
		UploadBasePath:  basePath,
	})
	if err != nil {
		events.Events.Error(strFailedToCreateJob)
		return
	}

	upload.Uploader(job)
}

//revive:enable:function-length

func getForceFlag(cmd *cobra.Command) bool {
	forceFlag, err := cmd.Flags().GetBool("force")
	if err != nil {
		events.Events.Warn("Error parsing force flag. Setting force to false")
		return false
	}
	if forceFlag {
		events.Events.Warn(strForceFlagTrue)
	}

	return forceFlag
}

func parseDownloadCommandArgs(args []string) (string, string, string) {
	return args[0], args[1], args[2]
}

func parseUploadCommandArgs(args []string) (string, []string) {
	return args[0], args[1:]
}

func fileMoverCommandInit() {
	global := globals.GetInstance()
	global.SetDaemonMode(false)

	if config.LoadConfiguration().General.NoSleep {
		utils.RunCaffeinate()
	}

	go service.NewService(service.GrpcDefaultHost, []uint{service.GrpcDefaultWebPort}, false)
	transferstats.Initialize()
}

func warnIfMaxFilesTooLow() {
	// Validate configuration values
	if maxActiveTransfers <= 0 {
		events.Events.Warn(fmt.Sprintf("Invalid configuration: max-active-transfers=%d", maxActiveTransfers))
		return
	}

	cfg := config.LoadConfiguration()
	var highestMaxThreads int
	for _, txp := range cfg.Protocols.S3.TransferProfiles {
		highestMaxThreads = max(highestMaxThreads, txp.Threads)
	}

	// Calculate with overflow check
	product := int64(maxActiveTransfers) * int64(highestMaxThreads)
	if product < 0 {
		events.Events.Warn(fmt.Sprintf(
			"Configuration overflow: max-active-transfers=%d * threads=%d would exceed limits",
			maxActiveTransfers,
			highestMaxThreads,
		))
		return
	}

	maxFiles := uint64(product)
	for _, limit := range supportfile.GetLimits() {
		if limit.Type == "MaxOpenFiles" {
			if maxFiles > limit.Soft {
				events.Events.Warn(fmt.Sprintf(strS3MaxActiveTransfersAndThreadsTooHigh, maxFiles, limit.Soft))
			}
		}
	}
}

func downloadObject(cmd *cobra.Command, args []string) {
	fileMoverCommandInit()

	txProfileName, destination, source := parseDownloadCommandArgs(args)
	forceFlag := getForceFlag(cmd)
	txProfile, err := config.LoadConfiguration().GetTransferProfile(txProfileName)
	if err != nil {
		events.Events.Error("error retrieving transfer profile %s: %v", txProfileName, err)
		return
	}
	prefixValue, err := cmd.Flags().GetString("prefix")
	if err != nil {
		events.Events.Warn("unable to retrieve prefix value: %v", err)
	}

	job, err := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
		Direction:       transfertypes.Download,
		Name:            source,
		TransferProfile: &txProfile,
		Sources:         []string{source},
		Destination:     filepath.Join(prefixValue, destination),
		Force:           forceFlag,
	})
	if err != nil {
		events.Events.Error(strFailedToCreateJob)
		return
	}

	download.Downloader(job)
}

func validateCredentials(_ *cobra.Command, args []string) {
	txProfileName := args[0]

	txProfile, err := config.LoadConfiguration().GetTransferProfile(txProfileName)
	errs.CheckError(err, "", true)

	s3m, err := transferapi.NewS3Manager(transferapi.S3ManagerConfig{
		AwsProfile: txProfile.Profile,
		Bucket:     txProfile.Bucket,
		Region:     txProfile.Region,
		Endpoint:   txProfile.Endpoint,
	})
	if err != nil {
		logger.Error(err.Error())
		return
	}

	if err = s3m.ValidateCredentials(); err != nil {
		events.Events.Warn(strS3UnableToListObjects, err)
		return
	}
	logger.Info(strS3ValidatedCreds, txProfileName)
}

func uploadArgsCheck(cmd *cobra.Command, args []string) error {
	return s3ArgsCheck(cmd, args, MinUploadArgs)
}

func downloadArgsCheck(cmd *cobra.Command, args []string) error {
	return s3ArgsCheck(cmd, args, MinDownloadArgs)
}

func s3ArgsCheck(cmd *cobra.Command, args []string, minArgs int) error {
	clitools.RegisterEventListener("s3cli")
	exitIfMinArgs(cmd, args, minArgs)

	cfg := config.LoadConfiguration()

	var txProfiles []string
	for txProfile := range cfg.Protocols.S3.TransferProfiles {
		txProfiles = append(txProfiles, txProfile)
	}

	if !utils.StringArrayContains(txProfiles, args[0]) {
		return fmt.Errorf(strInvalidTransferProfile, args[0], strings.Join(txProfiles, ", "))
	}

	return nil
}

func exitIfMinArgs(cmd *cobra.Command, args []string, minArgs int) {
	if len(args) < minArgs {
		if err := cmd.Usage(); err != nil {
			events.Events.Error(strFailedPrintingHelp)
		}
		os.Exit(1)
	}
}
