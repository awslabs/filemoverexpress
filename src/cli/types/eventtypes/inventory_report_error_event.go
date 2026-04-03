package eventtypes

import (
    "fmt"

    "github.com/awslabs/filemoverexpress/logger"
    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

type InventoryReportErrorEvent struct {
    ReportId            string
    TransferProfileName string
    Bucket              string
    Prefix              string
    Error               string
}

func (ire *InventoryReportErrorEvent) String() string {
    return fmt.Sprintf("Inventory report for %s (Prefix: %s) encountered an error: %s",
        ire.Bucket,
        ire.Prefix,
        ire.Error,
    )
}

func (*InventoryReportErrorEvent) Type() MessageFlags {
    return InventoryReportErrorEventType
}

func (*InventoryReportErrorEvent) Priority() logger.LogLevel {
    return EventPriority
}

func (ire *InventoryReportErrorEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
    pbEvent := &fmev1.InventoryReportErrorEvent{
        ReportId:        ire.ReportId,
        TransferProfile: ire.TransferProfileName,
        Bucket:          ire.Bucket,
        Prefix:          ire.Prefix,
        Error:           ire.Error,
    }
    msgEvent := fmev1.ListEventsResponse_InventoryReportErrorEvent{InventoryReportErrorEvent: pbEvent}
    return &msgEvent, fmev1.EventType_EVENT_TYPE_INVENTORY_REPORT_ERROR_EVENT_TYPE
}
