package eventtypes

import (
	"testing"

	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/stretchr/testify/assert"
)

func TestJobProgressEvent_String(t *testing.T) {
	evt := JobProgressEvent{
		Id:               "test-id",
		Name:             "test-name",
		BytesTransferred: 10,
		TotalBytes:       20,
	}
	expected := "Job progress for test-name: 10.00 Bytes/20.00 Bytes transferred"
	if evt.String() != expected {
		t.Errorf("TestJobProgressEvent_String failed, expected '%s', but got '%s'", expected, evt.String())
	}
}

func TestJobProgressEvent_Type(t *testing.T) {
	evt := JobProgressEvent{
		Id:               "",
		BytesTransferred: 0,
	}
	if evt.Type() != JobProgressEventType {
		t.Errorf("TestJobProgressEvent_Type failed, expected '%d', but got '%d'", JobProgressEventType, evt.Type())
	}
}

func TestJobProgressEvent_ToProtobuf(t *testing.T) {
	evt := JobProgressEvent{
		Id:               "",
		BytesTransferred: 0,
	}
	pbEvt, pbEvtType := evt.ToProtobuf()
	assert.Equal(t, fmev1.EventType_EVENT_TYPE_JOB_PROGRESS_EVENT_TYPE, pbEvtType)
	assert.IsType(t, &fmev1.ListEventsResponse_JobProgressEvent{}, pbEvt)
}

func TestJobProgressEvent_Priority(t *testing.T) {
	evt := JobProgressEvent{
		Id:               "",
		BytesTransferred: 0,
	}
	assert.Equal(t, JobProgressEventPriority, evt.Priority())
}
