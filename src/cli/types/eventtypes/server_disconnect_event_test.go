package eventtypes

import (
    "testing"

    "github.com/stretchr/testify/assert"

    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func TestServerDisconnectEvent_String(t *testing.T) {
    discoType := DaemonModeExit

    evt := ServerDisconnectEvent{
        DisconnectType: discoType,
    }

    expected := "GRPC host is shutting down. Reason: User-initiated daemon mode shutdown."
    if evt.String() != expected {
        t.Errorf("TestServerDisconnectEvent_String failed, expected '%s', but got '%s'", expected, evt.String())
    }
}

func TestServerDisconnectEvent_Type(t *testing.T) {
    discoType := DaemonModeExit

    evt := ServerDisconnectEvent{
        DisconnectType: discoType,
    }

    if evt.Type() != ServerDisconnectEventType {
        t.Errorf("TestServerDisconnectEvent_Type failed, expected '%d', but got '%d'", ServerDisconnectEventType, evt.Type())
    }
}

func TestServerDisconnectEvent_ToProtobuf(t *testing.T) {
    nghtRvnEvt := ServerDisconnectEvent{
        DisconnectType: UnknownDisconnectType,
    }

    pbEvt, pbEvtType := nghtRvnEvt.ToProtobuf()

    assert.Equal(t, fmev1.EventType_EVENT_TYPE_SERVER_DISCONNECT_EVENT_TYPE, pbEvtType)
    assert.IsType(t, &fmev1.ListEventsResponse_ServerDisconnectEvent{}, pbEvt)
}
