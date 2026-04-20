package jobmanagertypes

const (
	JobStatusCreated      JobStatus = "CREATED"
	JobStatusDiscovering  JobStatus = "DISCOVERING"
	JobStatusChecksumming JobStatus = "CHECKSUMMING"
	JobStatusFiltering    JobStatus = "FILTERING"
	JobStatusInProgress   JobStatus = "IN_PROGRESS"
	JobStatusPaused       JobStatus = "PAUSED"
	JobStatusCancelled    JobStatus = "CANCELLED"
	JobStatusCompleted    JobStatus = "COMPLETED"
	JobStatusError        JobStatus = "ERROR"
	JobStatusUnknown      JobStatus = "UNKNOWN"
)

type JobStatus string

func (j JobStatus) String() string {
	switch j {
	case JobStatusCreated:
		return "Created"
	case JobStatusDiscovering:
		return "Discovering"
	case JobStatusChecksumming:
		return "Checksumming"
	case JobStatusFiltering:
		return "Filtering"
	case JobStatusInProgress:
		return "In Progress"
	case JobStatusPaused:
		return "Paused"
	case JobStatusCancelled:
		return "Cancelled"
	case JobStatusCompleted:
		return "Completed"
	case JobStatusError:
		return "Error"
	default:
		return "Unknown"
	}
}

func JobStatusFromString(status string) JobStatus {
	switch status {
	case "CREATED":
		return JobStatusCreated
	case "DISCOVERING":
		return JobStatusDiscovering
	case "CHECKSUMMING":
		return JobStatusChecksumming
	case "FILTERING":
		return JobStatusFiltering
	case "IN_PROGRESS":
		return JobStatusInProgress
	case "PAUSED":
		return JobStatusPaused
	case "CANCELLED":
		return JobStatusCancelled
	case "COMPLETED":
		return JobStatusCompleted
	case "ERROR":
		return JobStatusError
	default:
		return JobStatusUnknown
	}
}

func (j JobStatus) Is(other string) bool {
	return other == string(j)
}
