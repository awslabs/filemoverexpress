package eventtypes

import (
	"fmt"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

type UnsupportedVersionEvent struct {
	NewSupportedVersion string
	CurrentVersion      string
	ReleaseNotes        []string
}

func (nva *UnsupportedVersionEvent) String() string {
	msg := "Your current version is no longer supported. Current version: %s, Newest supported version: %s. Visit %s to download"
	return fmt.Sprintf(
		msg,
		nva.CurrentVersion,
		nva.NewSupportedVersion,
		constants.MarketingPageUrl,
	)
}

func (*UnsupportedVersionEvent) Type() MessageFlags {
	return UnsupportedVersionEventType
}

func (*UnsupportedVersionEvent) Priority() logger.LogLevel {
	return UnsupportedVersionEventPriority
}

func (nva *UnsupportedVersionEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
	pbEvent := &fmev1.UnsupportedVersionEvent{
		NewSupportedVersion: nva.NewSupportedVersion,
		CurrentVersion:      nva.CurrentVersion,
		ReleaseNotes:        nva.ReleaseNotes,
	}
	msgEvent := fmev1.ListEventsResponse_UnsupportedVersionEvent{UnsupportedVersionEvent: pbEvent}
	return &msgEvent, fmev1.EventType_EVENT_TYPE_UNSUPPORTED_VERSION_EVENT_TYPE
}
