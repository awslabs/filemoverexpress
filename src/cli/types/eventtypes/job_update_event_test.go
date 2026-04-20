package eventtypes

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func TestJobUpdateEvent_String(t *testing.T) {
	evt := JobUpdateEvent{
		Id:      "test-id",
		Name:    "test-name",
		OldName: "old-test-name",
	}

	expected := "Renamed job old-test-name to test-name"
	if evt.String() != expected {
		t.Errorf("TestJobUpdateEvent_String failed, expected '%s', but got '%s'", expected, evt.String())
	}
}

func TestJobUpdateEvent_Type(t *testing.T) {
	evt := JobUpdateEvent{}
	if evt.Type() != JobUpdateEventType {
		t.Errorf("TestJobUpdateEvent_Type failed, expected '%d', but got '%d'", JobUpdateEventType, evt.Type())
	}
}

func TestJobUpdateEvent_ToProtobuf(t *testing.T) {
	evt := JobUpdateEvent{}

	pbEvt, pbEvtType := evt.ToProtobuf()

	assert.Equal(t, fmev1.EventType_EVENT_TYPE_JOB_UPDATE_EVENT_TYPE, pbEvtType)
	assert.IsType(t, &fmev1.ListEventsResponse_JobUpdateEvent{}, pbEvt)
}

func TestJobUpdateEvent_Priority(t *testing.T) {
	evt := JobUpdateEvent{}
	assert.Equal(t, JobUpdateEventPriority, evt.Priority())
}
