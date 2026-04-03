package eventtypes

import (
    "fmt"
    "time"

    "google.golang.org/protobuf/types/known/timestamppb"

    "github.com/awslabs/filemoverexpress/logger"
    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

type InventoryReportCompletedEvent struct {
    ReportId            string
    TransferProfileName string
    Bucket              string
    Prefix              string
    OutputFile          string
    CompleteTime        time.Time
}

func (irc *InventoryReportCompletedEvent) String() string {
    return fmt.Sprintf("Inventory report for %s (Prefix: %s) has completed and is available at %s",
        irc.Bucket,
        irc.Prefix,
        irc.OutputFile,
    )
}

func (*InventoryReportCompletedEvent) Type() MessageFlags {
    return InventoryReportCompletedEventType
}

func (*InventoryReportCompletedEvent) Priority() logger.LogLevel {
    return EventPriority
}

func (irc *InventoryReportCompletedEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
    pbEvent := &fmev1.InventoryReportCompletedEvent{
        ReportId:        irc.ReportId,
        TransferProfile: irc.TransferProfileName,
        Bucket:          irc.Bucket,
        Prefix:          irc.Prefix,
        OutputFile:      irc.OutputFile,
        CompleteTime:    timestamppb.New(irc.CompleteTime),
    }
    msgEvent := fmev1.ListEventsResponse_InventoryReportCompletedEvent{InventoryReportCompletedEvent: pbEvent}
    return &msgEvent, fmev1.EventType_EVENT_TYPE_INVENTORY_REPORT_COMPLETED_EVENT_TYPE
}
