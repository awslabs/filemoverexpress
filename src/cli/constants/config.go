package constants

const (
	DefaultMaxActiveTransfers = 10
	DefaultThreads            = 10
	DefaultChunkSize          = 25
	DefaultChecksumAlgorithm  = AlgorithmNone
	DefaultChecksumEnabled    = false
	DefaultLoggingMaxAge      = 31
	DefaultLoggingMaxSize     = 50
	DefaultRetryCount         = 3
	MaxRetryCount             = 10000
	MinChunkSize              = 5

	DefaultNoSleep                 = false
	DefaultTargetBandwidth         = 0
	DefaultLoggingDirectory        = "logs"
	DefaultLoggingSeverity         = "info"
	DefaultLoggingCompress         = true
	DefaultReportsDirectory        = "reports"
	DefaultAPIServerEnabled        = true
	DefaultAPIServerTLSEnabled     = false
	DefaultAPIServerRemoteEnabled  = false
	DefaultAllowUIConfiguration    = false
	DefaultAllowLocalRenameDelete  = false
	DefaultAllowRemoteRenameDelete = false
)

var ConfigDefaults = map[string]int{
	"max_active_checksums": DefaultMaxActiveTransfers,
	"max_active_transfers": DefaultMaxActiveTransfers,
	"threads":              DefaultThreads,
	"chunk_size":           DefaultChunkSize,
	"logging_max_age":      DefaultLoggingMaxAge,
	"logging_max_size":     DefaultLoggingMaxSize,
	"retry_count":          DefaultRetryCount,
}
