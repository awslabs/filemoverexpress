package constants

const (
	// General
	DefaultNoSleep            = false
	DefaultRetryCount         = 3
	MaxRetryCount             = 10000
	DefaultMaxActiveTransfers = 100
	// DefaultAutoMaxActiveTransfers is the default for the opt-in AutoMAT toggle.
	// When false, maxActiveTransfers uses its explicit value (DefaultMaxActiveTransfers
	// unless overridden). When true, the daemon auto-scales concurrency to the machine.
	DefaultAutoMaxActiveTransfers = false
	DefaultTargetBandwidth        = 0

	// Logging
	DefaultLoggingDirectory = "logs"
	DefaultLoggingSeverity  = "info"
	DefaultLoggingMaxSize   = 50
	DefaultLoggingMaxAge    = 31
	DefaultLoggingCompress  = true

	// Reports
	DefaultReportsDirectory = "reports"

	// APIServer
	DefaultAPIServerEnabled            = true
	DefaultAPIServerTLSEnabled         = false
	DefaultAPIServerTLSCertificateFile = ""
	DefaultAPIServerTLSKeyFile         = ""
	DefaultAPIServerRemoteEnabled      = false
	DefaultAPIServerRemotePreSharedKey = ""
	DefaultAPIServerRemoteAddress      = ""
	DefaultAllowUIConfiguration        = false
	DefaultAllowLocalRenameDelete      = false
	DefaultAllowRemoteRenameDelete     = false

	// TransferProfile
	DefaultThreads           = 10
	DefaultChunkSize         = 25
	MinChunkSize             = 5
	DefaultChecksumAlgorithm = AlgorithmNone
	DefaultChecksumEnabled   = false
)
