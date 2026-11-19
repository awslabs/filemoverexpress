package eventtypes

import (
	"fmt"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/utils/safeconv"
)

type JobCompleteEvent struct {
	Id                 string
	Name               string
	CompletionTime     time.Time
	HasTaskErrors      bool
	HasSuccessfulTasks bool
	HasAllSkippedTasks bool
	// Status is the terminal job status (COMPLETED or COMPLETED_WITH_WARNINGS).
	// The GUI takes the final status from this event, so it must be populated or
	// a verify-failed job renders as a clean COMPLETED.
	Status string
	// ASC MHL verification outcome, carried so the GUI's jobs-table column and the
	// Advanced-details counts update live on completion rather than only after a
	// full job-list refresh.
	ASCMHLVerified  int
	ASCMHLListed    int
	ASCMHLProblems  int
	ASCMHLAlgorithm string
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
	ascVerified, _ := safeconv.IntToInt32(dce.ASCMHLVerified)
	ascListed, _ := safeconv.IntToInt32(dce.ASCMHLListed)
	ascProblems, _ := safeconv.IntToInt32(dce.ASCMHLProblems)
	pbEvent := &fmev1.JobCompleteEvent{
		Id:                 dce.Id,
		Name:               dce.Name,
		Completed:          timestamppb.New(dce.CompletionTime),
		HasTaskErrors:      dce.HasTaskErrors,
		HasSuccessfulTasks: dce.HasSuccessfulTasks,
		HasAllSkippedTasks: dce.HasAllSkippedTasks,
		Status:             dce.Status,
		AscMhlVerified:     ascVerified,
		AscMhlListed:       ascListed,
		AscMhlProblems:     ascProblems,
		AscMhlAlgorithm:    dce.ASCMHLAlgorithm,
	}
	msgEvent := fmev1.ListEventsResponse_JobCompleteEvent{JobCompleteEvent: pbEvent}
	return &msgEvent, fmev1.EventType_EVENT_TYPE_JOB_COMPLETE_EVENT_TYPE
}
