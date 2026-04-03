package eventtypes

import (
    "testing"

    "github.com/stretchr/testify/assert"

    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func TestTaskCompleteEvent_String(t *testing.T) {
    expected := "Completed transfer my/destination/path"
    evt := TaskCompleteEvent{
        Id:          "random-id",
        Direction:   "upload",
        Destination: "my/destination/path",
    }

    if evt.String() != expected {
        t.Errorf("TestTaskCompleteEvent_String failed, expected '%s', but got '%s'", expected, evt.String())
    }
}

func TestTaskCompleteEvent_Type(t *testing.T) {
    evt := TaskCompleteEvent{
        Id:          "random-id",
        Direction:   "upload",
        Destination: "my/destination/path",
    }
    if evt.Type() != TaskCompleteEventType {
        t.Errorf("TestTaskCompleteEvent_Type failed, expected '%d', but got '%d'", TaskCompleteEventType, evt.Type())
    }
}

func TestTaskCompleteEvent_ToProtobuf(t *testing.T) {
    evt := TaskCompleteEvent{
        Id:          "random-id",
        Direction:   "upload",
        Destination: "my/destination/path",
    }

    pbEvt, pbEvtType := evt.ToProtobuf()

    assert.Equal(t, fmev1.EventType_EVENT_TYPE_TASK_COMPLETE_EVENT_TYPE, pbEvtType)
    assert.IsType(t, &fmev1.ListEventsResponse_TaskCompleteEvent{}, pbEvt)
}
