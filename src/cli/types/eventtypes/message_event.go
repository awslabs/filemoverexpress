package eventtypes

import (
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

type MessageEvent struct {
	Msg           string
	EventPriority logger.LogLevel
}

func (e *MessageEvent) String() string {
	return e.Msg
}

func (*MessageEvent) Type() MessageFlags {
	return MessageEventType
}

func (e *MessageEvent) Priority() logger.LogLevel {
	return e.EventPriority
}

func (e *MessageEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
	pbEvent := &fmev1.MessageEvent{Msg: e.String(), LogLevel: string(e.Priority())}
	msgEvent := fmev1.ListEventsResponse_MessageEvent{MessageEvent: pbEvent}
	return &msgEvent, fmev1.EventType_EVENT_TYPE_MESSAGE_EVENT_TYPE
}
