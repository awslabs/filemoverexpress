// Package mcpserver implements the MCP server that exposes FME daemon
// capabilities as MCP tools for AI assistants.
package mcpserver

// --- Connection ---

// FmeConnectInput is the input for the fme_connect tool.
type FmeConnectInput struct {
	Address string `json:"address,omitempty" jsonschema:"ConnectRPC address of the FME daemon"`
	AuthKey string `json:"auth_key,omitempty" jsonschema:"Pre-shared key for remote daemons"`
}

// FmeConnectOutput is the output for the fme_connect tool.
type FmeConnectOutput struct {
	Address string `json:"address"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

// --- Jobs ---

// ListJobsInput is the input for the fme_list_jobs tool.
type ListJobsInput struct{}

// JobOutput represents a single job in the list jobs response.
type JobOutput struct {
	JobID           string `json:"job_id"`
	Name            string `json:"name"`
	Status          string `json:"status"`
	Direction       string `json:"direction"`
	TransferProfile string `json:"transfer_profile"`
	TotalBytes      int64  `json:"total_bytes"`
	BytesUploaded   int64  `json:"bytes_uploaded"`
	BytesDownloaded int64  `json:"bytes_downloaded"`
	Destination     string `json:"destination"`
	Bucket          string `json:"bucket"`
	HasTaskErrors   bool   `json:"has_task_errors"`
}

// ListJobsOutput is the output for the fme_list_jobs tool.
type ListJobsOutput struct {
	Jobs []JobOutput `json:"jobs"`
}

// --- Browse ---

// BrowseLocalInput is the input for the fme_browse_local_folder tool.
type BrowseLocalInput struct {
	Path string `json:"path" jsonschema:"Absolute path to list"`
}

// FileEntry represents a single file in a local directory listing.
type FileEntry struct {
	Path         string `json:"path"`
	Size         int64  `json:"size"`
	LastModified string `json:"last_modified"`
}

// LocalFolderOutput is the output for the fme_browse_local_folder tool.
type LocalFolderOutput struct {
	Path    string      `json:"path"`
	Folders []string    `json:"folders"`
	Files   []FileEntry `json:"files"`
}

// BrowseS3Input is the input for the fme_browse_s3_prefix tool.
type BrowseS3Input struct {
	TransferProfile string `json:"transfer_profile" jsonschema:"Name of the transfer profile to use"`
	Prefix          string `json:"prefix,omitempty" jsonschema:"S3 prefix to list (empty for bucket root)"`
}

// S3ObjEntry represents a single object in an S3 prefix listing.
type S3ObjEntry struct {
	Key          string `json:"key"`
	Size         int64  `json:"size"`
	LastModified string `json:"last_modified"`
	StorageClass string `json:"storage_class"`
}

// S3FolderOutput is the output for the fme_browse_s3_prefix tool.
type S3FolderOutput struct {
	Prefix   string       `json:"prefix"`
	Prefixes []string     `json:"prefixes"`
	Objects  []S3ObjEntry `json:"objects"`
}

// --- Transfer ---

// StartUploadInput is the input for the fme_start_upload tool.
type StartUploadInput struct {
	TransferProfile string   `json:"transfer_profile" jsonschema:"Name of the transfer profile"`
	Prefixes        []string `json:"prefixes" jsonschema:"Local paths to upload"`
	Destination     string   `json:"destination" jsonschema:"S3 destination prefix"`
	BasePath        string   `json:"base_path,omitempty" jsonschema:"Base path for relative resolution"`
	JobName         string   `json:"job_name,omitempty" jsonschema:"Human-readable job name"`
	Force           bool     `json:"force,omitempty" jsonschema:"Force transfer regardless of filters"`
}

// StartUploadOutput is the output for the fme_start_upload tool.
type StartUploadOutput struct {
	Success bool   `json:"success"`
	JobID   string `json:"job_id"`
	Status  string `json:"status"`
}

// StartDownloadInput is the input for the fme_start_download tool.
type StartDownloadInput struct {
	TransferProfile string   `json:"transfer_profile" jsonschema:"Name of the transfer profile"`
	Prefixes        []string `json:"prefixes" jsonschema:"S3 keys or prefixes to download"`
	Destination     string   `json:"destination" jsonschema:"Local destination path"`
	JobName         string   `json:"job_name,omitempty" jsonschema:"Human-readable job name"`
	Force           bool     `json:"force,omitempty" jsonschema:"Force transfer regardless of filters"`
}

// StartDownloadOutput is the output for the fme_start_download tool.
type StartDownloadOutput struct {
	StatusCode string `json:"status_code"`
	JobID      string `json:"job_id"`
}

// --- Job Control ---

// JobIDInput is the input for job control tools (pause, resume, cancel).
type JobIDInput struct {
	JobID string `json:"job_id" jsonschema:"ID of the job to act on"`
}

// JobActionOutput is the output for job control tools (pause, resume, cancel).
type JobActionOutput struct {
	JobID   string `json:"job_id"`
	Success bool   `json:"success"`
}
