package eventtypes

import (
	"fmt"

	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

type JobChecksumProgressEvent struct {
	JobId     string
	Total     int32
	Completed int32
}

func (jcpe *JobChecksumProgressEvent) String() string {
	if jcpe.Total == 0 {
		return fmt.Sprintf("No files to checksum for '%s'", jcpe.JobId)
	}

	pct := float64(jcpe.Completed) / float64(jcpe.Total) * 100
	// This string is passed to the logger.<Level> function, which also calls `fmt.Sprintf`,
	// so we need to double-escape the `%` sign, hence `%%%%`
	return fmt.Sprintf(
		"Checksum progress for '%s': %.2f%%%% (%d of %d)",
		jcpe.JobId,
		pct,
		jcpe.Completed,
		jcpe.Total,
	)
}

func (*JobChecksumProgressEvent) Type() MessageFlags {
	return JobChecksumProgressEventType
}

func (*JobChecksumProgressEvent) Priority() logger.LogLevel {
	return JobChecksumProgressEventPriority
}

func (jcpe *JobChecksumProgressEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
	pbEvent := &fmev1.JobChecksumProgressEvent{
		JobId:     jcpe.JobId,
		Total:     jcpe.Total,
		Completed: jcpe.Completed,
	}

	msgEvent := fmev1.ListEventsResponse_JobChecksumProgressEvent{JobChecksumProgressEvent: pbEvent}
	return &msgEvent, fmev1.EventType_EVENT_TYPE_JOB_CHECKSUM_PROGRESS_EVENT
}
