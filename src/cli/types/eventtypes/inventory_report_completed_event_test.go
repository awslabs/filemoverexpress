package eventtypes

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func TestInventoryReportCompletedEvent_String(t *testing.T) {

	evt := InventoryReportCompletedEvent{
		ReportId:            "1",
		TransferProfileName: "transfer-profile",
		Bucket:              "bucket",
		Prefix:              "prefix",
		OutputFile:          "blah.txt",
		CompleteTime:        time.Time{},
	}

	expected := "Inventory report for bucket (Prefix: prefix) has completed and is available at blah.txt"
	if evt.String() != expected {
		t.Errorf("TestInventoryReportCompletedEvent_String failed, expected '%s', but got '%s'", expected, evt.String())
	}
}

func TestInventoryReportCompletedEvent_Type(t *testing.T) {
	evt := InventoryReportCompletedEvent{
		ReportId:            "1",
		TransferProfileName: "transfer-profile",
		Bucket:              "bucket",
		Prefix:              "prefix",
		OutputFile:          "blah.txt",
		CompleteTime:        time.Time{},
	}

	if evt.Type() != InventoryReportCompletedEventType {
		t.Errorf("TestInventoryReportCompletedEvent_Type failed, expected '%d', but got '%d'", InventoryReportCompletedEventType, evt.Type())
	}
}

func TestInventoryReportCompletedEvent_ToProtobuf(t *testing.T) {
	evt := InventoryReportCompletedEvent{
		ReportId:            "1",
		TransferProfileName: "transfer-profile",
		Bucket:              "bucket",
		Prefix:              "prefix",
		OutputFile:          "blah.txt",
		CompleteTime:        time.Time{},
	}

	pbEvt, pbEvtType := evt.ToProtobuf()

	assert.Equal(t, fmev1.EventType_EVENT_TYPE_INVENTORY_REPORT_COMPLETED_EVENT_TYPE, pbEvtType)
	assert.IsType(t, &fmev1.ListEventsResponse_InventoryReportCompletedEvent{}, pbEvt)
}

func TestInventoryReportCompletedEvent_Priority(t *testing.T) {
	evt := InventoryReportCompletedEvent{
		ReportId:            "1",
		TransferProfileName: "transfer-profile",
		Bucket:              "bucket",
		Prefix:              "prefix",
		OutputFile:          "blah.txt",
		CompleteTime:        time.Time{},
	}
	assert.Equal(t, EventPriority, evt.Priority())
}
