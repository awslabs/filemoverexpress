// Package mcpserver implements the MCP server that exposes FME daemon
// capabilities as MCP tools for AI assistants.
package mcpserver

type (
	// FmeConnectInput is the input for the fme_connect tool.
	FmeConnectInput struct {
		Address string `json:"address,omitempty" jsonschema:"ConnectRPC address of the FME daemon"`
		AuthKey string `json:"auth_key,omitempty" jsonschema:"Pre-shared key for remote daemons"`
	}

	// FmeConnectOutput is the output for the fme_connect tool.
	FmeConnectOutput struct {
		Address string `json:"address"`
		Status  string `json:"status"`
		Message string `json:"message"`
	}

	// ListJobsInput is the input for the fme_list_jobs tool.
	ListJobsInput struct{}

	// JobOutput represents a single job in the list jobs response.
	JobOutput struct {
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
	ListJobsOutput struct {
		Jobs []JobOutput `json:"jobs"`
	}

	// BrowseLocalInput is the input for the fme_browse_local_folder tool.
	BrowseLocalInput struct {
		Path string `json:"path" jsonschema:"Absolute path to list"`
	}

	// FileEntry represents a single file in a local directory listing.
	FileEntry struct {
		Path         string `json:"path"`
		Size         int64  `json:"size"`
		LastModified string `json:"last_modified"`
	}

	// LocalFolderOutput is the output for the fme_browse_local_folder tool.
	LocalFolderOutput struct {
		Path    string      `json:"path"`
		Folders []string    `json:"folders"`
		Files   []FileEntry `json:"files"`
	}

	// BrowseS3Input is the input for the fme_browse_s3_prefix tool.
	BrowseS3Input struct {
		TransferProfile string `json:"transfer_profile" jsonschema:"Name of the transfer profile to use"`
		Prefix          string `json:"prefix,omitempty" jsonschema:"S3 prefix to list (empty for bucket root)"`
	}

	// S3ObjEntry represents a single object in an S3 prefix listing.
	S3ObjEntry struct {
		Key          string `json:"key"`
		Size         int64  `json:"size"`
		LastModified string `json:"last_modified"`
		StorageClass string `json:"storage_class"`
	}
)
