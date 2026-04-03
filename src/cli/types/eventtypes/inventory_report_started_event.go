package eventtypes

import (
    "fmt"
    "time"

    "google.golang.org/protobuf/types/known/timestamppb"

    "github.com/awslabs/filemoverexpress/logger"
    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

type InventoryReportStartedEvent struct {
    ReportId            string
    TransferProfileName string
    Bucket              string
    Prefix              string
    StartTime           time.Time
}

func (irs *InventoryReportStartedEvent) String() string {
    return fmt.Sprintf("An inventory report is being generated for %s (Prefix: %s)",
        irs.Bucket,
        irs.Prefix,
    )
}

func (*InventoryReportStartedEvent) Type() MessageFlags {
    return InventoryReportStartedEventType
}

func (*InventoryReportStartedEvent) Priority() logger.LogLevel {
    return EventPriority
}

func (irs *InventoryReportStartedEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
    pbEvent := &fmev1.InventoryReportStartedEvent{
        ReportId:        irs.ReportId,
        TransferProfile: irs.TransferProfileName,
        Bucket:          irs.Bucket,
        Prefix:          irs.Prefix,
        StartTime:       timestamppb.New(irs.StartTime),
    }
    msgEvent := fmev1.ListEventsResponse_InventoryReportStartedEvent{InventoryReportStartedEvent: pbEvent}
    return &msgEvent, fmev1.EventType_EVENT_TYPE_INVENTORY_REPORT_STARTED_EVENT_TYPE
}
