package eventtypes

import (
    "errors"
    "testing"
    "time"

    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
    "github.com/stretchr/testify/assert"
)

func TestJobErrorEvent_String(t *testing.T) {
    evt := JobErrorEvent{
        Id:        "test-id",
        Name:      "test-name",
        ErrorTime: time.Now(),
        Err:       errors.New("test error"),
    }

    expected := "Error for job test-name - test error"
    if evt.String() != expected {
        t.Errorf("TestJobErrorEvent_String failed, expected '%s', but got '%s'", expected, evt.String())
    }
}

func TestJobErrorEvent_Type(t *testing.T) {
    evt := JobErrorEvent{
        Id:        "test-id",
        ErrorTime: time.Now(),
        Err:       errors.New("test error"),
    }
    if evt.Type() != JobErrorEventType {
        t.Errorf("TestJobErrorEvent_Type failed, expected '%d', but got '%d'", JobErrorEventType, evt.Type())
    }
}

func TestJobErrorEvent_ToProtobuf(t *testing.T) {
    evt := JobErrorEvent{
        Id:        "test-id",
        ErrorTime: time.Now(),
        Err:       errors.New("test error"),
    }

    pbEvt, pbEvtType := evt.ToProtobuf()

    assert.Equal(t, fmev1.EventType_EVENT_TYPE_JOB_ERROR_EVENT_TYPE, pbEvtType)
    assert.IsType(t, &fmev1.ListEventsResponse_JobErrorEvent{}, pbEvt)
}

func TestJobErrorEvent_Priority(t *testing.T) {
    evt := JobErrorEvent{
        Id:        "test-id",
        ErrorTime: time.Now(),
        Err:       errors.New("test error"),
    }
    assert.Equal(t, JobErrorEventPriority, evt.Priority())
}
