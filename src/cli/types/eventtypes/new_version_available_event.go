package eventtypes

import (
	"fmt"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

type NewVersionAvailableEvent struct {
	NewVersion     string
	CurrentVersion string
	ReleaseNotes   []string
}

func (nva *NewVersionAvailableEvent) String() string {
	msg := "A new version is available. Current version: %s, New version: %s. Visit %s to download"
	return fmt.Sprintf(
		msg,
		nva.CurrentVersion,
		nva.NewVersion,
		constants.MarketingPageUrl,
	)
}

func (*NewVersionAvailableEvent) Type() MessageFlags {
	return NewVersionAvailableEventType
}

func (*NewVersionAvailableEvent) Priority() logger.LogLevel {
	return EventPriority
}

func (nva *NewVersionAvailableEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
	pbEvent := &fmev1.NewVersionAvailableEvent{
		NewVersion:     nva.NewVersion,
		CurrentVersion: nva.CurrentVersion,
		ReleaseNotes:   nva.ReleaseNotes,
	}
	msgEvent := fmev1.ListEventsResponse_NewVersionAvailableEvent{NewVersionAvailableEvent: pbEvent}
	return &msgEvent, fmev1.EventType_EVENT_TYPE_NEW_VERSION_AVAILABLE_EVENT_TYPE
}
