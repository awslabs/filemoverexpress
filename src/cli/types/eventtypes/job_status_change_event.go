package eventtypes

import (
	"fmt"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

type (
	JobStatusChangeEvent struct {
		Id        string
		Status    string
		Timestamp time.Time
		// ASCMHL is the ASC MHL verification outcome, or nil when no supplied
		// manifest was verified. Carried so a NEEDS_REVIEW pause (which has no
		// completion event yet) can show real counts and the failing-file list in
		// the pre-upload gate dialog.
		ASCMHL *ASCMHLEventData
	}

	// ASCMHLEventData is the ASC MHL verification outcome carried on job events.
	// Counts are int32 to map straight onto the protobuf types without a checked
	// conversion. A nil *ASCMHLEventData means no manifest was verified, so the
	// event carries no ASC MHL data at all (the common case).
	ASCMHLEventData struct {
		Verified  int32
		Listed    int32
		Problems  int32
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
	pbEvent := fmev1.JobStatusChangeEvent{
		JobId:     jsce.Id,
		Status:    jsce.Status,
		Timestamp: timestamppb.New(jsce.Timestamp),
		AscMhl:    jsce.ASCMHL.toProtobuf(),
	}

	msgEvent := &fmev1.ListEventsResponse_JobStatusChangeEvent{JobStatusChangeEvent: &pbEvent}

	return msgEvent, fmev1.EventType_EVENT_TYPE_JOB_STATUS_CHANGE_EVENT_TYPE
}

// toProtobuf maps the ASC MHL payload to its protobuf message, or nil when there
// is no payload (no manifest verified). Fields are already int32, so no checked
// conversion is needed here.
func (a *ASCMHLEventData) toProtobuf() *fmev1.AscMhlResult {
	if a == nil {
		return nil
	}
	return &fmev1.AscMhlResult{
		Verified:  a.Verified,
		Listed:    a.Listed,
		Problems:  a.Problems,
		Algorithm: a.Algorithm,
		Failures:  a.Failures,
	}
}
