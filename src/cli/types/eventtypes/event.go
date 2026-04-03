package eventtypes

import (
    "github.com/awslabs/filemoverexpress/logger"
    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

//nolint:decorder
const (
    AllEvents MessageFlags = iota
    _
    MessageEventType

    InventoryReportStartedEventType
    InventoryReportCompletedEventType
    InventoryReportErrorEventType

    MetadataEventType
    ConfigurationUpdateEventType
    NewVersionAvailableEventType
    UnsupportedVersionEventType
    AlertEventType
    ServerDisconnectEventType

    _
    JobProgressEventType
    JobCompleteEventType
    JobErrorEventType
    JobUpdateEventType
    TaskCompleteEventType
    JobStatusChangeEventType
    JobCreateEventType
    JobChecksumProgressEventType
    TransferStatsEventType
)

//nolint:decorder
const (
    JobErrorEventPriority = logger.ErrorLevel
    EventPriority         = logger.InfoLevel
    ServerDisconnectEventPriority
    MetadataEventPriority
    ConfigurationUpdateEventPriority
    UnsupportedVersionEventPriority
    JobStatusChangeEventPriority
    JobCreateEventPriority
    JobProgressEventPriority
    JobCompleteEventPriority
    JobUpdateEventPriority
    TaskCompleteEventPriority
    JobChecksumProgressEventPriority
    TransferStatsEventPriority
)

type (
    MessageFlags   int32
    DisconnectType int16
    Event          interface {
        String() string
        Type() MessageFlags
        Priority() logger.LogLevel
        ToProtobuf() (fmev1.PbEvent, fmev1.EventType)
    }
)
