package eventtypes

import (
	"fmt"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

type JobErrorEvent struct {
	Id        string
	Name      string
	ErrorTime time.Time
	Err       error
}

func (jee *JobErrorEvent) String() string {
	return fmt.Sprintf("Error for job %s - %s", jee.Name, jee.Err.Error())
}

func (*JobErrorEvent) Type() MessageFlags {
	return JobErrorEventType
}

func (*JobErrorEvent) Priority() logger.LogLevel {
	return JobErrorEventPriority
}

func (jee *JobErrorEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
	pbEvent := &fmev1.JobErrorEvent{
		Id:        jee.Id,
		Name:      jee.Name,
		ErrorTime: timestamppb.New(jee.ErrorTime),
		Error:     jee.Err.Error(),
	}
	msgEvent := fmev1.ListEventsResponse_JobErrorEvent{JobErrorEvent: pbEvent}
	return &msgEvent, fmev1.EventType_EVENT_TYPE_JOB_ERROR_EVENT_TYPE
}
