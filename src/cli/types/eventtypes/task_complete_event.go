package eventtypes

import (
	"fmt"

	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

type TaskCompleteEvent struct {
	Id          string
	Direction   string
	Destination string
}

func (tce *TaskCompleteEvent) String() string {
	return fmt.Sprintf("Completed transfer %s", tce.Destination)
}

func (*TaskCompleteEvent) Type() MessageFlags {
	return TaskCompleteEventType
}

func (*TaskCompleteEvent) Priority() logger.LogLevel {
	return TaskCompleteEventPriority
}

func (tce *TaskCompleteEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
	pbEvent := &fmev1.TaskCompleteEvent{
		Id:          tce.Id,
		Direction:   tce.Direction,
		Destination: tce.Destination,
	}
	msgEvent := fmev1.ListEventsResponse_TaskCompleteEvent{TaskCompleteEvent: pbEvent}
	return &msgEvent, fmev1.EventType_EVENT_TYPE_TASK_COMPLETE_EVENT_TYPE
}
