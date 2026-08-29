package cmd

//revive:disable:line-length-limit
const (
	strHelp                   = "help"
	strInvalidArg             = "invalid argument '%s' given"
	strFailedPrintingHelp     = "failed to print command help"
	strInvalidTransferProfile = "invalid transfer profile %s. Valid transfer profiles: %s"
	strDaemonAlreadyRunning   = "daemon is already running with pid %d"

	strDaemonDescription       = "High-speed S3 file transfer tool"
	strDaemonHelp              = "Run in daemon mode to use hot-folder feature"
	strDaemon                  = "daemon"
	strDaemonUnsupportedOS     = "unsupported OS %s\n"
	strDaemonNoTransferProfile = "No transfer profile defined. Check that there is at least one transfer profile defined in your configuration file and that the configuration file is correctly formatted."
	strWeakPSK                 = "The remote key provided is weak. This will reduce the security of your system. Recommended keys contain at least 8 characters. "

	strDaemonFailedInitializingDaemon = "Failed to initialize the daemon: %s\n"

	strSupportFileUse  = "support-file"
	strSupportFileHelp = "Gather debugging info"

	strRootLongHelp               = "A high speed file transfer tool that adds checksums to objects stored in S3 for later validation"
	strRootShortHelp              = "High speed file transfer tool"
	strRootUse                    = "%s [daemon|help] <args>"
	strRootFailedGettingUserInfo  = "Failed to get current user information: %s\n"
	strRootRunningAsRoot          = "You are running this tool as root. This can be very dangerous and should be avoided"
	strRootRunningAsAdministrator = "You are running this tool as Administrator. This can be very dangerous and should be avoided"

	strUpload                                = "upload"
	strS3UploadUse                           = "upload <transfer-profile> <sources...>"
	strS3UploadHelp                          = "Upload files"
	strDownload                              = "download"
	strS3DownloadUse                         = "download <transfer-profile> <destination> <path>"
	strS3DownloadHelp                        = "Download files"
	strValidateTransferProfile               = "validate-credentials"
	strS3ValidateCredentialsUse              = "validate-credentials <transfer-profile>" //#nosec
	strS3ValidateCredentialsShortHelp        = "AWS credential validation"               //#nosec
	strS3ValidateCredentialsLongHelp         = "Validates the provided AWS credentials for a given transfer profile configuration"
	strS3ProfileUsage                        = "AWS profile"
	strS3ThreadUsage                         = "Number of threads per upload"
	strS3ChunkSizeUsage                      = "Chunk size in MB"
	strS3MaxAgeUsage                         = "Max age for files to process"
	strS3FilterUsage                         = "Filter files to transfer (regular expression)"
	strS3MaxActiveTransfersUsage             = "Max number of active transfers (default 100)"
	strS3AutoMaxActiveTransfersUsage         = "Auto-scale active transfers to the machine (CPU cores / open-file limit). Can raise throughput on capable hosts, but on slower or shared machines it may cause resource contention and less predictable behavior. When set, overrides --max-active-transfers."
	strS3ForceUsage                          = "Forces transfers regardless of filters or conflicts"
	strS3ChecksumAlgorithmUsage              = "Checksum algorithm"
	strS3RetryCountUsage                     = "Maximum number of retries if an error occurs"
	strS3MaxActiveChecksumsUsage             = "Max number of active checksums"
	strS3FailedBindingFlags                  = "Failed to bind flag: %s"
	strS3MaxActiveTransfersAndThreadsTooHigh = "The max_active_transfers and threads configuration is configured to open more files (%d) than the current system configuration allows (%d)"
	strS3ValidatedCreds                      = "Validated credentials for %s"
	strS3UnableToListObjects                 = "Unable to list objects: %s"
	strS3EnableMetadataFilterUsage           = "Enable filtering system metadata files from uploads"
	strS3PrefixUsage                         = "S3 Prefix path for uploads and downloads"
	strS3AutoTuningUsage                     = "Allow tool to decide the best configuration values to optimize transfer"

	strInventory                      = "inventory"
	strS3InventoryUse                 = "inventory <transfer-profile>"
	strS3InventoryHelp                = "List S3 bucket contents"
	strS3InventoryOutputFormat        = "Output format for report. Supported formats: %s"
	strS3InventoryPrettyUsage         = "Format json or xml for human-readable output"
	strS3InventoryInvalidOutputFormat = "invalid output format %s. Supported formats: %s"
	strFailedGeneratingInventory      = "failed to generate inventory report: %s"

	strRemoteAddress             = "Address of remote daemon. Requires use of --remote"
	strRemotePortList            = "Port value(s) to listen on in a comma-separated list. Requires use of --remote"
	strRemoteEnabled             = "Enable remote daemon. Must be set in order to use address/ports flags"
	strRemoteIncorrectAddressUse = "--address can only be set when using the --remote flag. Ignoring %s"
	strRemoteIncorrectPortsUse   = "--ports can only be set when using the --remote flag. Ignoring ports"
	strRemoteWithoutKey          = "you can't start a remote daemon without setting a key"
	strRemoteTLSRequired         = "To run the daemon remotely, set api_server.tls_enabled to true in the configuration file and add a proper certificate and a certificate key path"

	strCreditsUse         = "credits"
	strCreditsHelp        = "Display 3rd party attribution information" //#nosec G101 -- False positive
	strCreditsExplanation = "This application uses a number of third-party libraries. Links to their licensing information can be found below."

	strForceFlagTrue            = "WARNING: Force flag set to true. Ignoring all filters and conflicts"
	strCompletion               = "completion"
	strFailedToCreateJob        = "failed to create job"
	strErrorGettingDir          = "error retrieving the directory for %s: %s"
	strMustBeAbsoluteOrRelative = "upload paths cannot be both absolute and relative"
	strUnsupportedCharInPath    = "unsupported character in upload path: '%s'"
)
