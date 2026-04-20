package eventtypes

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func TestInventoryReportStartedEvent_String(t *testing.T) {

	evt := InventoryReportStartedEvent{
		ReportId:            "",
		TransferProfileName: "",
		Bucket:              "",
		Prefix:              "",
		StartTime:           time.Time{},
	}

	expected := "An inventory report is being generated for  (Prefix: )"
	if evt.String() != expected {
		t.Errorf("TestInventoryReportStartedEvent_String failed, expected '%s', but got '%s'", expected, evt.String())
	}
}

func TestInventoryReportStartedEvent_Type(t *testing.T) {
	evt := InventoryReportStartedEvent{
		ReportId:            "",
		TransferProfileName: "",
		Bucket:              "",
		Prefix:              "",
		StartTime:           time.Time{},
	}

	if evt.Type() != InventoryReportStartedEventType {
		t.Errorf("TestInventoryReportStartedEvent_Type failed, expected '%d', but got '%d'", InventoryReportStartedEventType, evt.Type())
	}
}

func TestInventoryReportStartedEvent_ToProtobuf(t *testing.T) {
	evt := InventoryReportStartedEvent{
		ReportId:            "",
		TransferProfileName: "",
		Bucket:              "",
		Prefix:              "",
		StartTime:           time.Time{},
	}

	pbEvt, pbEvtType := evt.ToProtobuf()

	assert.Equal(t, fmev1.EventType_EVENT_TYPE_INVENTORY_REPORT_STARTED_EVENT_TYPE, pbEvtType)
	assert.IsType(t, &fmev1.ListEventsResponse_InventoryReportStartedEvent{}, pbEvt)
}

func TestInventoryReportStartedEvent_Priority(t *testing.T) {
	evt := InventoryReportStartedEvent{
		ReportId:            "",
		TransferProfileName: "",
		Bucket:              "",
		Prefix:              "",
		StartTime:           time.Time{},
	}
	assert.Equal(t, EventPriority, evt.Priority())
}
