package eventtypes

import (
	"fmt"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/utils/safeconv"
)

type (
	JobStatusChangeEvent struct {
		Id        string
		Status    string
		Timestamp time.Time
		// ASC MHL verification outcome, carried so a NEEDS_REVIEW pause (no
		// completion event yet) can show real counts in the pre-upload gate dialog.
		ASCMHLVerified  int
		ASCMHLListed    int
		ASCMHLProblems  int
		ASCMHLAlgorithm string
		ASCMHLFailures  []string
	}

	// ASCMHLSummary bundles a job's ASC MHL verification counts so they can be
	// passed as a single argument (keeping callers within the argument limit).
	ASCMHLSummary struct {
		Verified  int
		Listed    int
		Problems  int
		Algorithm string
		Failures  []string
	}
)

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
	ascVerified, _ := safeconv.IntToInt32(jsce.ASCMHLVerified)
	ascListed, _ := safeconv.IntToInt32(jsce.ASCMHLListed)
	ascProblems, _ := safeconv.IntToInt32(jsce.ASCMHLProblems)
	pbEvent := fmev1.JobStatusChangeEvent{
		JobId:           jsce.Id,
		Status:          jsce.Status,
		Timestamp:       timestamppb.New(jsce.Timestamp),
		AscMhlVerified:  ascVerified,
		AscMhlListed:    ascListed,
		AscMhlProblems:  ascProblems,
		AscMhlAlgorithm: jsce.ASCMHLAlgorithm,
		AscMhlFailures:  jsce.ASCMHLFailures,
	}

	msgEvent := &fmev1.ListEventsResponse_JobStatusChangeEvent{JobStatusChangeEvent: &pbEvent}

	return msgEvent, fmev1.EventType_EVENT_TYPE_JOB_STATUS_CHANGE_EVENT_TYPE
}
