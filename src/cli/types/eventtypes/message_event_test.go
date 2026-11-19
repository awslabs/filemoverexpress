package eventtypes

import (
	"testing"

	"github.com/awslabs/filemoverexpress/logger"
	fmev1 "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func TestMessageEvent_String(t *testing.T) {
	ts := "Hello world"
	evt := MessageEvent{
		Msg: ts,
	}

	if evt.String() != ts {
		t.Errorf("TestMessageEvent_String failed, expected '%s', but got '%s'", ts, evt.String())
	}
}

func TestMessageEvent_Type(t *testing.T) {
	evt := MessageEvent{
		Msg: "Hello world",
	}

	if evt.Type() != MessageEventType {
		t.Errorf("TestMessageEvent_Type failed, expected '%d', but got '%d'", MessageEventType, evt.Type())
	}
}

// A job-scoped message carries its job id through to the protobuf so the GUI
// can file it under that job's Logs tab.
func TestMessageEvent_ToProtobufCarriesJobID(t *testing.T) {
	evt := MessageEvent{Msg: "Verifying 3 files", EventPriority: logger.InfoLevel, JobID: "job-123"}

	pb, typ := evt.ToProtobuf()
	if typ != fmev1.EventType_EVENT_TYPE_MESSAGE_EVENT_TYPE {
		t.Fatalf("unexpected event type %v", typ)
	}
	me, ok := pb.(*fmev1.ListEventsResponse_MessageEvent)
	if !ok {
		t.Fatalf("expected *ListEventsResponse_MessageEvent, got %T", pb)
	}
	if me.MessageEvent.JobId != "job-123" {
		t.Errorf("expected JobId job-123, got %q", me.MessageEvent.JobId)
	}
	if me.MessageEvent.Msg != "Verifying 3 files" {
		t.Errorf("expected msg to round-trip, got %q", me.MessageEvent.Msg)
	}
}

// A global (non-job) message leaves the job id empty.
func TestMessageEvent_ToProtobufEmptyJobIDByDefault(t *testing.T) {
	evt := MessageEvent{Msg: "daemon message", EventPriority: logger.InfoLevel}

	pb, _ := evt.ToProtobuf()
	me, ok := pb.(*fmev1.ListEventsResponse_MessageEvent)
	if !ok {
		t.Fatalf("expected *ListEventsResponse_MessageEvent, got %T", pb)
	}
	if me.MessageEvent.JobId != "" {
		t.Errorf("expected empty JobId, got %q", me.MessageEvent.JobId)
	}
}
