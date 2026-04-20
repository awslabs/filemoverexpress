package eventtypes

import (
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

type ConfigurationUpdateEvent struct{}

func (*ConfigurationUpdateEvent) String() string {
	return "Configuration updated"
}

func (*ConfigurationUpdateEvent) Type() MessageFlags {
	return ConfigurationUpdateEventType
}

func (*ConfigurationUpdateEvent) Priority() logger.LogLevel {
	return ConfigurationUpdateEventPriority
}

func (*ConfigurationUpdateEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
	pbEvent := &fmev1.ConfigurationUpdateEvent{}

	msgEvent := fmev1.ListEventsResponse_ConfigurationUpdateEvent{ConfigurationUpdateEvent: pbEvent}
	return &msgEvent, fmev1.EventType_EVENT_TYPE_CONFIGURATION_UPDATE_EVENT_TYPE
}
