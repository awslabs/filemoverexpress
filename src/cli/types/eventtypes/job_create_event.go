package eventtypes

import (
	"fmt"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	transfer "github.com/awslabs/filemoverexpress/types/transfertypes"
)

type JobCreateEvent struct {
	Id                  string
	Name                string
	Created             time.Time
	TransferProfileName string
	Destination         string
	Direction           transfer.Direction
	Status              string
}

func (jce *JobCreateEvent) String() string {
	return fmt.Sprintf("Created job %s", jce.Name)
}

func (*JobCreateEvent) Type() MessageFlags {
	return JobCreateEventType
}

func (*JobCreateEvent) Priority() logger.LogLevel {
	return JobCreateEventPriority
}

func (jce *JobCreateEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
	var direction string
	if jce.Direction == transfer.Download {
		direction = "download"
	} else {
		direction = "upload"
	}

	pbEvent := &fmev1.JobCreateEvent{
		Id:              jce.Id,
		Name:            jce.Name,
		Created:         timestamppb.New(jce.Created),
		TransferProfile: jce.TransferProfileName,
		Destination:     jce.Destination,
		Direction:       direction,
		Status:          jce.Status,
	}
	msgEvent := fmev1.ListEventsResponse_JobCreateEvent{JobCreateEvent: pbEvent}
	return &msgEvent, fmev1.EventType_EVENT_TYPE_JOB_CREATE_EVENT_TYPE
}
