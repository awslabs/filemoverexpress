package eventtypes

import (
	"fmt"

	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/utils"
)

type JobProgressEvent struct {
	Id               string
	Name             string
	BytesTransferred int64
	TotalBytes       int64
}

func (jpe *JobProgressEvent) String() string {
	return fmt.Sprintf("Job progress for %s: %s/%s transferred", jpe.Name, utils.FormatBytes(jpe.BytesTransferred),
		utils.FormatBytes(jpe.TotalBytes))
}

func (*JobProgressEvent) Type() MessageFlags {
	return JobProgressEventType
}

func (*JobProgressEvent) Priority() logger.LogLevel {
	return JobProgressEventPriority
}

func (jpe *JobProgressEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
	pbEvent := &fmev1.JobProgressEvent{
		Id:               jpe.Id,
		Name:             jpe.Name,
		BytesTransferred: jpe.BytesTransferred,
		TotalBytes:       jpe.TotalBytes,
	}
	msgEvent := fmev1.ListEventsResponse_JobProgressEvent{JobProgressEvent: pbEvent}
	return &msgEvent, fmev1.EventType_EVENT_TYPE_JOB_PROGRESS_EVENT_TYPE
}
