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

func TestJobCompleteEvent_Priority(t *testing.T) {
	evt := JobCompleteEvent{
		Id:             "",
		CompletionTime: time.Now(),
	}
	assert.Equal(t, JobCompleteEventPriority, evt.Priority())
}
