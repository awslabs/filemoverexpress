package eventtypes

import (
    "fmt"
    "testing"

    "github.com/stretchr/testify/assert"

    "github.com/awslabs/filemoverexpress/constants"

    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func TestNewVersionAvailableEvent_String(t *testing.T) {
    evt := NewVersionAvailableEvent{
        NewVersion:     "v2.0.0",
        CurrentVersion: "fmev1.0.0",
    }

    expected := fmt.Sprintf("A new version is available. Current version: fmev1.0.0, New version: v2.0.0. Visit %s to download", constants.MarketingPageUrl)
    if evt.String() != expected {
        t.Errorf("TestNewVersionAvailableEvent_String failed, expected '%s', but got '%s'", expected, evt.String())
    }
}

func TestNewVersionAvailableEvent_Type(t *testing.T) {
    evt := NewVersionAvailableEvent{
        NewVersion:     "v2.0.0",
        CurrentVersion: "fmev1.0.0",
    }

    if evt.Type() != NewVersionAvailableEventType {
        t.Errorf("TestNewVersionAvailableEvent_Type failed, expected '%d', but got '%d'", NewVersionAvailableEventType, evt.Type())
    }
}

func TestNewVersionAvailableEvent_ToProtobuf(t *testing.T) {
    evt := NewVersionAvailableEvent{
        NewVersion:     "v2.0.0",
        CurrentVersion: "fmev1.0.0",
    }

    pbEvt, pbEvtType := evt.ToProtobuf()

    assert.Equal(t, fmev1.EventType_EVENT_TYPE_NEW_VERSION_AVAILABLE_EVENT_TYPE, pbEvtType)
    assert.IsType(t, &fmev1.ListEventsResponse_NewVersionAvailableEvent{}, pbEvt)
}

func TestNewVersionAvailableEvent_Priority(t *testing.T) {
    evt := NewVersionAvailableEvent{
        NewVersion:     "v2.0.0",
        CurrentVersion: "fmev1.0.0",
    }
    assert.Equal(t, EventPriority, evt.Priority())
}
