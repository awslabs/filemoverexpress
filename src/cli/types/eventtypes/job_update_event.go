package eventtypes

import (
	"fmt"

	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

type JobUpdateEvent struct {
	Id      string
	Name    string
	OldName string
}

func (jue *JobUpdateEvent) String() string {
	return fmt.Sprintf("Renamed job %s to %s", jue.OldName, jue.Name)
}

func (*JobUpdateEvent) Type() MessageFlags {
	return JobUpdateEventType
}

func (*JobUpdateEvent) Priority() logger.LogLevel {
	return JobUpdateEventPriority
}

func (jue *JobUpdateEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
	pbEvent := &fmev1.JobUpdateEvent{
		Id:      jue.Id,
		OldName: jue.OldName,
		Name:    jue.Name,
	}
	msgEvent := fmev1.ListEventsResponse_JobUpdateEvent{JobUpdateEvent: pbEvent}
	return &msgEvent, fmev1.EventType_EVENT_TYPE_JOB_UPDATE_EVENT_TYPE
}
