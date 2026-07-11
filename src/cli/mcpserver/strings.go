package mcpserver

// Tool names for all 9 MCP tools.
const (
	ToolFmeConnect        = "fme_connect"
	ToolFmeListJobs       = "fme_list_jobs"
	ToolBrowseLocalFolder = "fme_browse_local_folder"
	ToolBrowseS3Prefix    = "fme_browse_s3_prefix"
	ToolStartUpload       = "fme_start_upload"
	ToolStartDownload     = "fme_start_download"
	ToolPauseJob          = "fme_pause_job"
	ToolResumeJob         = "fme_resume_job"
	ToolCancelJob         = "fme_cancel_job"
)

// Tool descriptions — each summarises the tool's purpose in a single sentence.
const (
	DescFmeConnect        = "Connect to an FME daemon at the specified address"
	DescFmeListJobs       = "List all active transfer jobs on the connected FME daemon"
	DescBrowseLocalFolder = "Browse the contents of a local folder on the daemon host"
	DescBrowseS3Prefix    = "Browse objects under an S3 prefix using a transfer profile"
	DescStartUpload       = "Start uploading local files to S3 using a transfer profile"
	DescStartDownload     = "Start downloading S3 objects to a local path using a transfer profile"
	DescPauseJob          = "Pause an active transfer job"
	DescResumeJob         = "Resume a paused transfer job"
	DescCancelJob         = "Cancel a transfer job"
)

// Error message templates.
const (
	// ErrNotConnected is returned when a tool is called while the ClientManager
	// is not connected. Placeholders: daemon address, connection status.
	ErrNotConnected = "not connected to daemon at %s (status: %s)"

	// ErrRemoteAuthRequired is returned when a remote daemon address is provided
	// without an auth key.
	ErrRemoteAuthRequired = "remote daemons require auth_key"

	// MsgRetrying is written to stderr when the retry loop starts.
	// Placeholder: retry interval in seconds.
	MsgRetrying = "retrying connection every %ds"
)

// Default values for connection and protocol settings.
const (
	DefaultDaemonAddr = "http://127.0.0.1:50006"
	OriginHeaderValue = "mcp://fme"
	OriginHeaderKey   = "Origin"
	AuthHeaderKey     = "x-fme-key"
	RetryIntervalSec  = 30
)
