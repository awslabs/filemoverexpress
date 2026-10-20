package notifications

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func samplePayload() Payload {
	return Payload{
		JobName:    "Day 14 camera cards",
		Outcome:    OutcomeSuccess,
		Bucket:     "show-dailies",
		Prefix:     "day14/camera/",
		Host:       "edit-bay-03",
		FinishedAt: time.Date(2026, 10, 14, 16, 12, 4, 0, time.UTC),
	}
}

func TestEncodeBody_SlackUsesText(t *testing.T) {
	body, err := encodeBody(configtypes.NotificationPreset(fmev1.NotificationPreset_NOTIFICATION_PRESET_SLACK), samplePayload())
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	var out map[string]string
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !strings.Contains(out["text"], "Day 14 camera cards - done") {
		t.Errorf("slack body missing summary: %q", out["text"])
	}
	if !strings.Contains(out["text"], "show-dailies/day14/camera/") {
		t.Errorf("slack body missing destination: %q", out["text"])
	}
}

func TestEncodeBody_DiscordUsesContent(t *testing.T) {
	body, err := encodeBody(configtypes.NotificationPreset(fmev1.NotificationPreset_NOTIFICATION_PRESET_DISCORD), samplePayload())
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	var out map[string]string
	_ = json.Unmarshal(body, &out)
	if out["content"] == "" {
		t.Errorf("discord body should use 'content' field, got %s", body)
	}
}

func TestEncodeBody_CustomJSONHasStableFields(t *testing.T) {
	p := samplePayload()
	p.Outcome = OutcomeFailed
	body, err := encodeBody(configtypes.NotificationPreset(fmev1.NotificationPreset_NOTIFICATION_PRESET_CUSTOM_JSON), p)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	var out map[string]interface{}
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if out["event"] != "transfer.failed" {
		t.Errorf("expected event transfer.failed, got %v", out["event"])
	}
	if out["bucket"] != "show-dailies" || out["prefix"] != "day14/camera/" {
		t.Errorf("custom payload missing bucket/prefix: %v", out)
	}
}

func TestOutcomeLabel(t *testing.T) {
	if OutcomeSuccess.label() != "done" || OutcomeFailed.label() != "failed" {
		t.Errorf("unexpected outcome labels")
	}
}
