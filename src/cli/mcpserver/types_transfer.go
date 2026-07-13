package mcpserver

type (
	// S3FolderOutput is the output for the fme_browse_s3_prefix tool.
	S3FolderOutput struct {
		Prefix   string       `json:"prefix"`
		Prefixes []string     `json:"prefixes"`
		Objects  []S3ObjEntry `json:"objects"`
	}

	// StartUploadInput is the input for the fme_start_upload tool.
	StartUploadInput struct {
		TransferProfile string   `json:"transfer_profile" jsonschema:"Name of the transfer profile"`
		Prefixes        []string `json:"prefixes" jsonschema:"Local paths to upload"`
		Destination     string   `json:"destination" jsonschema:"S3 destination prefix"`
		BasePath        string   `json:"base_path,omitempty" jsonschema:"Base path for relative resolution"`
		JobName         string   `json:"job_name,omitempty" jsonschema:"Human-readable job name"`
		Force           bool     `json:"force,omitempty" jsonschema:"Force transfer regardless of filters"`
	}

	// StartUploadOutput is the output for the fme_start_upload tool.
	StartUploadOutput struct {
		Success bool   `json:"success"`
		JobID   string `json:"job_id"`
		Status  string `json:"status"`
	}

	// StartDownloadInput is the input for the fme_start_download tool.
	StartDownloadInput struct {
		TransferProfile string   `json:"transfer_profile" jsonschema:"Name of the transfer profile"`
		Prefixes        []string `json:"prefixes" jsonschema:"S3 keys or prefixes to download"`
		Destination     string   `json:"destination" jsonschema:"Local destination path"`
		JobName         string   `json:"job_name,omitempty" jsonschema:"Human-readable job name"`
		Force           bool     `json:"force,omitempty" jsonschema:"Force transfer regardless of filters"`
	}

	// StartDownloadOutput is the output for the fme_start_download tool.
	StartDownloadOutput struct {
		StatusCode string `json:"status_code"`
		JobID      string `json:"job_id"`
	}

	// JobIDInput is the input for job control tools (pause, resume, cancel).
	JobIDInput struct {
		JobID string `json:"job_id" jsonschema:"ID of the job to act on"`
	}

	// JobActionOutput is the output for job control tools (pause, resume, cancel).
	JobActionOutput struct {
		JobID   string `json:"job_id"`
		Success bool   `json:"success"`
	}
)
