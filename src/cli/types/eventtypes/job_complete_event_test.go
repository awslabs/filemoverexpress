package eventtypes

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func TestJobCompleteEvent_String(t *testing.T) {
	evt := JobCompleteEvent{
		Id:             "test-id",
		Name:           "test-name",
		CompletionTime: time.Now(),
	}

	expected := "Completed job test-name"
	if evt.String() != expected {
		t.Errorf("TestJobCompleteEvent_String failed, expected '%s', but got '%s'", expected, evt.String())
	}
}

func TestJobCompleteEvent_Type(t *testing.T) {
	evt := JobCompleteEvent{
		Id:             "",
		CompletionTime: time.Now(),
	}
	if evt.Type() != JobCompleteEventType {
		t.Errorf("TestJobCompleteEvent_Type failed, expected '%d', but got '%d'", JobCompleteEventType, evt.Type())
	}
}

func TestJobCompleteEvent_ToProtobuf(t *testing.T) {
	evt := JobCompleteEvent{
		Id:             "",
		CompletionTime: time.Now(),
	}

	pbEvt, pbEvtType := evt.ToProtobuf()

	assert.Equal(t, fmev1.EventType_EVENT_TYPE_JOB_COMPLETE_EVENT_TYPE, pbEvtType)
	assert.IsType(t, &fmev1.ListEventsResponse_JobCompleteEvent{}, pbEvt)
}

// The terminal status must survive serialization so the GUI can keep a
// verify-failed job amber instead of flattening it to a clean COMPLETED, and the
// ASC MHL result must ride along so the jobs-table column updates on completion.
func TestJobCompleteEvent_ToProtobuf_CarriesStatus(t *testing.T) {
	evt := JobCompleteEvent{
		Id:              "id",
		CompletionTime:  time.Now(),
		Status:          "COMPLETED_WITH_WARNINGS",
		ASCMHLVerified:  1,
		ASCMHLListed:    3,
		ASCMHLProblems:  2,
		ASCMHLAlgorithm: "xxhash64",
	}

	pbEvt, _ := evt.ToProtobuf()

	wrapper, ok := pbEvt.(*fmev1.ListEventsResponse_JobCompleteEvent)
	assert.True(t, ok)
	assert.Equal(t, "COMPLETED_WITH_WARNINGS", wrapper.JobCompleteEvent.GetStatus())
	assert.Equal(t, int32(1), wrapper.JobCompleteEvent.GetAscMhlVerified())
	assert.Equal(t, int32(3), wrapper.JobCompleteEvent.GetAscMhlListed())
	assert.Equal(t, int32(2), wrapper.JobCompleteEvent.GetAscMhlProblems())
	assert.Equal(t, "xxhash64", wrapper.JobCompleteEvent.GetAscMhlAlgorithm())
}

func TestJobCompleteEvent_Priority(t *testing.T) {
	evt := JobCompleteEvent{
		Id:             "",
		CompletionTime: time.Now(),
	}
	assert.Equal(t, JobCompleteEventPriority, evt.Priority())
}
