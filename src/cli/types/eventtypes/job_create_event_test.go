package eventtypes

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func TestJobCreateEvent_String(t *testing.T) {
	evt := JobCreateEvent{
		Id:                  "test-id",
		Name:                "test-name",
		Created:             time.Now(),
		TransferProfileName: "test-profile",
		Destination:         "/path/to/folder",
		Direction:           "upload",
		Status:              "QUEUED",
	}
	expected := "Created job test-name"
	if evt.String() != expected {
		t.Errorf("TestJobCreateEvent_String failed, expected '%s', but got '%s'", expected, evt.String())
	}
}

func TestJobCreateEvent_Type(t *testing.T) {
	evt := JobCreateEvent{}
	if evt.Type() != JobCreateEventType {
		t.Errorf("TestJobCreateEvent_Type failed, expected '%d', but got '%d'", JobCreateEventType, evt.Type())
	}
}

func TestJobCreateEvent_ToProtobuf(t *testing.T) {
	evt := JobCreateEvent{}
	pbEvt, pbEvtType := evt.ToProtobuf()
	assert.Equal(t, fmev1.EventType_EVENT_TYPE_JOB_CREATE_EVENT_TYPE, pbEvtType)
	assert.IsType(t, &fmev1.ListEventsResponse_JobCreateEvent{}, pbEvt)
}

func TestJobCreateEvent_Priority(t *testing.T) {
	evt := JobCreateEvent{}
	assert.Equal(t, JobCreateEventPriority, evt.Priority())
}
