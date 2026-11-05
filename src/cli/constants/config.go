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

	// Connection tuning. DefaultMaxConnectionsPerHost bounds the total simultaneous
	// connections the S3 client opens to one host (a global connection ceiling across
	// every active transfer and every multipart part). 0 means no limit, matching the
	// AWS SDK default. DefaultSendBufferBytes caps each socket's send buffer (SO_SNDBUF);
	// 0 means leave the OS default. macOS overrides the send-buffer default to
	// MacOSDefaultSendBufferBytes because its kernel network memory pool is small and
	// fixed, so unbounded per-socket buffers exhaust it (ENOBUFS). This is the in-app
	// equivalent of raising net.inet.tcp.autosndbufmax, so users need no sudo sysctl.
	DefaultMaxConnectionsPerHost = 0
	DefaultSendBufferBytes       = 0

	// DefaultAdaptiveConcurrency is ON by default (opt-out). When true, the daemon
	// derives per-file threads and a shared, OS-aware connection budget from each
	// job's file sizes instead of the fixed threads / auto-tuning path. It is the
	// safe default because unbounded concurrency can exhaust a small kernel network
	// pool (macOS at MTU 1500) and fail transfers outright; adaptive bounds the socket
	// count so transfers complete. Set adaptiveConcurrency: false in the config to
	// opt out (e.g. a hand-tuned high-throughput Linux jumbo-frame setup).
	DefaultAdaptiveConcurrency  = true
	MacOSDefaultSendBufferBytes = 2 * 1024 * 1024

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
