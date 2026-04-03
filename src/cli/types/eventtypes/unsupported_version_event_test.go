package eventtypes

import (
    "fmt"
    "testing"

    "github.com/stretchr/testify/assert"

    "github.com/awslabs/filemoverexpress/constants"

    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func TestUnsupportedVersionEvent_String(t *testing.T) {
    evt := UnsupportedVersionEvent{
        NewSupportedVersion: "fmev1.0.0",
        CurrentVersion:      "v2.0.0",
    }

    expected := fmt.Sprintf("Your current version is no longer supported. Current version: v2.0.0, "+
        "Newest supported version: fmev1.0.0. Visit %s to download", constants.MarketingPageUrl)
    if evt.String() != expected {
        t.Errorf("TestUnsupportedVersionEvent_String failed, expected '%s', but got '%s'", expected, evt.String())
    }
}

func TestUnsupportedVersionEvent_Type(t *testing.T) {
    evt := UnsupportedVersionEvent{
        NewSupportedVersion: "fmev1.0.0",
        CurrentVersion:      "v2.0.0",
    }

    if evt.Type() != UnsupportedVersionEventType {
        t.Errorf("TestUnsupportedVersionEvent_Type failed, expected '%d', but got '%d'", UnsupportedVersionEventType, evt.Type())
    }
}

func TestUnsupportedVersionEvent_ToProtobuf(t *testing.T) {
    evt := UnsupportedVersionEvent{
        NewSupportedVersion: "fmev1.0.0",
        CurrentVersion:      "v2.0.0",
    }

    pbEvt, pbEvtType := evt.ToProtobuf()

    assert.Equal(t, fmev1.EventType_EVENT_TYPE_UNSUPPORTED_VERSION_EVENT_TYPE, pbEvtType)
    assert.IsType(t, &fmev1.ListEventsResponse_UnsupportedVersionEvent{}, pbEvt)
}

func TestUnsupportedVersionEvent_Priority(t *testing.T) {
    evt := UnsupportedVersionEvent{
        NewSupportedVersion: "fmev1.0.0",
        CurrentVersion:      "v2.0.0",
    }
    assert.Equal(t, EventPriority, evt.Priority())
}
