package eventtypes

import (
	"github.com/awslabs/filemoverexpress/logger"
	fmev1 "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

const (
	Info    NotificationLevel = 0 << iota
	Warning NotificationLevel = 1 << iota
	Error
	Success
	Default
)

type (
	NotificationLevel int
	AlertEvent        struct {
		Msg           string
		EventPriority logger.LogLevel
		Level         NotificationLevel
	}
)

func (l NotificationLevel) String() string {
	switch l {
	case Info:
		return "info"
	case Warning:
		return "warning"
	case Error:
		return "error"
	case Success:
		return "success"
	case Default:
		return "default"
	}
	return "Unknown notification level"
}

func (e *AlertEvent) String() string {
	return e.Msg
}

func (*AlertEvent) Type() MessageFlags {
	return AlertEventType
}

func (e *AlertEvent) Priority() logger.LogLevel {
	return e.EventPriority
}

func (e *AlertEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
	pbEvent := &fmev1.AlertEvent{Msg: e.String(), Level: e.Level.String()}
	msgEvent := fmev1.ListEventsResponse_AlertEvent{AlertEvent: pbEvent}
	return &msgEvent, fmev1.EventType_EVENT_TYPE_ALERT_EVENT_TYPE
}
