package eventtypes

import (
    "fmt"

    "github.com/awslabs/filemoverexpress/logger"
    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

//goland:noinspection ALL
const (
    UnknownDisconnectType DisconnectType = 0 << iota
    CliDownloadsComplete  DisconnectType = 1 << iota
    CliUploadsComplete
    DaemonModeExit
)

var DisconnectEventReasons = map[DisconnectType]string{
    0: "Unknown",
    2: "Download(s) completed",
    4: "Upload(s) completed",
    8: "User-initiated daemon mode shutdown",
}

type ServerDisconnectEvent struct {
    DisconnectType DisconnectType
}

func (sde *ServerDisconnectEvent) String() string {
    return fmt.Sprintf("GRPC host is shutting down. Reason: %s.", DisconnectEventReasons[sde.DisconnectType])
}

func (*ServerDisconnectEvent) Type() MessageFlags {
    return ServerDisconnectEventType
}

func (*ServerDisconnectEvent) Priority() logger.LogLevel {
    return ServerDisconnectEventPriority
}

func (sde *ServerDisconnectEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
    pbEvent := &fmev1.ServerDisconnectEvent{
        DisconnectType: fmev1.DisconnectType(sde.DisconnectType),
    }
    msgEvent := fmev1.ListEventsResponse_ServerDisconnectEvent{ServerDisconnectEvent: pbEvent}
    return &msgEvent, fmev1.EventType_EVENT_TYPE_SERVER_DISCONNECT_EVENT_TYPE
}
