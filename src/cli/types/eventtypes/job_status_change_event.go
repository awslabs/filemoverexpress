package eventtypes

import (
    "fmt"
    "time"

    "google.golang.org/protobuf/types/known/timestamppb"

    "github.com/awslabs/filemoverexpress/logger"
    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

type JobStatusChangeEvent struct {
    Id        string
    Status    string
    Timestamp time.Time
}

func (jsce *JobStatusChangeEvent) String() string {
    return fmt.Sprintf("Job %s status changed to %s", jsce.Id, jsce.Status)
}

func (*JobStatusChangeEvent) Type() MessageFlags {
    return JobStatusChangeEventType
}

func (*JobStatusChangeEvent) Priority() logger.LogLevel {
    return JobStatusChangeEventPriority
}

func (jsce *JobStatusChangeEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
    pbEvent := fmev1.JobStatusChangeEvent{
        JobId:     jsce.Id,
        Status:    jsce.Status,
        Timestamp: timestamppb.New(jsce.Timestamp),
    }

    msgEvent := &fmev1.ListEventsResponse_JobStatusChangeEvent{JobStatusChangeEvent: &pbEvent}

    return msgEvent, fmev1.EventType_EVENT_TYPE_JOB_STATUS_CHANGE_EVENT_TYPE
}
