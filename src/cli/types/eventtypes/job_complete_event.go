package eventtypes

import (
	"fmt"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

type JobCompleteEvent struct {
	Id                 string
	Name               string
	CompletionTime     time.Time
	HasTaskErrors      bool
	HasSuccessfulTasks bool
	HasAllSkippedTasks bool
	// Status is the terminal job status (COMPLETED, COMPLETED_WITH_WARNINGS, or
	// ERROR when no file transferred and at least one failed). The GUI takes the
	// final status from this event, so it must be populated or a verify-failed or
	// all-failed job renders as a clean COMPLETED.
	Status string
	// ASCMHL is the ASC MHL verification outcome, or nil when no supplied manifest
	// was verified. Carried so the GUI's jobs-table column and the Advanced-details
	// counts update live on completion rather than only after a full job-list
	// refresh.
	ASCMHL *ASCMHLEventData
}

func (dce *JobCompleteEvent) String() string {
	return fmt.Sprintf("Completed job %s", dce.Name)
}

func (*JobCompleteEvent) Type() MessageFlags {
	return JobCompleteEventType
}

func (*JobCompleteEvent) Priority() logger.LogLevel {
	return JobCompleteEventPriority
}

func (dce *JobCompleteEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
	pbEvent := &fmev1.JobCompleteEvent{
		Id:                 dce.Id,
		Name:               dce.Name,
		Completed:          timestamppb.New(dce.CompletionTime),
		HasTaskErrors:      dce.HasTaskErrors,
		HasSuccessfulTasks: dce.HasSuccessfulTasks,
		HasAllSkippedTasks: dce.HasAllSkippedTasks,
		Status:             dce.Status,
		AscMhl:             dce.ASCMHL.toProtobuf(),
	}
	msgEvent := fmev1.ListEventsResponse_JobCompleteEvent{JobCompleteEvent: pbEvent}
	return &msgEvent, fmev1.EventType_EVENT_TYPE_JOB_COMPLETE_EVENT_TYPE
}
