package eventtypes

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func TestInventoryReportErrorEvent_String(t *testing.T) {

	evt := InventoryReportErrorEvent{
		ReportId:            "1",
		TransferProfileName: "TransferProfile",
		Bucket:              "Bucket",
		Prefix:              "Prefix",
		Error:               "Error",
	}

	expected := "Inventory report for Bucket (Prefix: Prefix) encountered an error: Error"
	if evt.String() != expected {
		t.Errorf("TestInventoryReportErrorEvent_String failed, expected '%s', but got '%s'", expected, evt.String())
	}
}

func TestInventoryReportErrorEvent_Type(t *testing.T) {
	evt := InventoryReportErrorEvent{
		ReportId:            "1",
		TransferProfileName: "TransferProfile",
		Bucket:              "Bucket",
		Prefix:              "Prefix",
		Error:               "Error",
	}

	if evt.Type() != InventoryReportErrorEventType {
		t.Errorf("TestInventoryReportErrorEvent_Type failed, expected '%d', but got '%d'", InventoryReportErrorEventType, evt.Type())
	}
}

func TestInventoryReportErrorEvent_ToProtobuf(t *testing.T) {
	evt := InventoryReportErrorEvent{
		ReportId:            "1",
		TransferProfileName: "TransferProfile",
		Bucket:              "Bucket",
		Prefix:              "Prefix",
		Error:               "Error",
	}

	pbEvt, pbEvtType := evt.ToProtobuf()

	assert.Equal(t, fmev1.EventType_EVENT_TYPE_INVENTORY_REPORT_ERROR_EVENT_TYPE, pbEvtType)
	assert.IsType(t, &fmev1.ListEventsResponse_InventoryReportErrorEvent{}, pbEvt)
}

func TestInventoryReportErrorEvent_Priority(t *testing.T) {
	evt := InventoryReportErrorEvent{
		ReportId:            "1",
		TransferProfileName: "TransferProfile",
		Bucket:              "Bucket",
		Prefix:              "Prefix",
		Error:               "Error",
	}
	assert.Equal(t, EventPriority, evt.Priority())
}
