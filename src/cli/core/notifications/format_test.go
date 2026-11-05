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
		IsUpload:   true,
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
	if !strings.Contains(out["text"], "s3://show-dailies/day14/camera/") {
		t.Errorf("slack body missing s3 destination: %q", out["text"])
	}
}

func TestText_IncludesStatsWhenPresent(t *testing.T) {
	p := samplePayload()
	p.HasStats = true
	p.FilesTransferred = 12
	p.BytesTransferred = 3_200_000_000
	p.FilesSkipped = 2
	p.BytesSkipped = 1_000_000
	p.FilesErrored = 1
	p.BytesErrored = 500_000
	p.Duration = 48 * time.Second
	text := p.text()
	for _, want := range []string{"12 files transferred", "3.2 GB", "2 skipped", "1 errored", "Average speed:"} {
		if !strings.Contains(text, want) {
			t.Errorf("stats text missing %q in %q", want, text)
		}
	}
}

func TestDestinationDisplay_CleanJoinNoDoubleSlash(t *testing.T) {
	p := Payload{IsUpload: true, Bucket: "nsft2testing", Prefix: "/foldersa/"}
	if got := p.destinationDisplay(); got != "s3://nsft2testing/foldersa/" {
		t.Errorf("expected clean s3 uri, got %q", got)
	}
}

func TestEncodeBody_TeamsUsesWorkflowsAdaptiveCard(t *testing.T) {
	body, err := encodeBody(configtypes.NotificationPreset(fmev1.NotificationPreset_NOTIFICATION_PRESET_TEAMS), samplePayload())
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	// Must be the Workflows "type":"message" envelope, NOT the retired MessageCard.
	if strings.Contains(string(body), "MessageCard") {
		t.Fatalf("Teams body still uses retired MessageCard format: %s", body)
	}
	var out struct {
		Type        string `json:"type"`
		Attachments []struct {
			ContentType string `json:"contentType"`
			Content     struct {
				Type string `json:"type"`
				Body []struct {
					Text string `json:"text"`
				} `json:"body"`
			} `json:"content"`
		} `json:"attachments"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if out.Type != "message" {
		t.Errorf("expected envelope type 'message', got %q", out.Type)
	}
	if len(out.Attachments) != 1 {
		t.Fatalf("expected 1 attachment, got %d", len(out.Attachments))
	}
	att := out.Attachments[0]
	if att.ContentType != "application/vnd.microsoft.card.adaptive" {
		t.Errorf("wrong attachment contentType: %q", att.ContentType)
	}
	if att.Content.Type != "AdaptiveCard" {
		t.Errorf("expected AdaptiveCard content, got %q", att.Content.Type)
	}
	if len(att.Content.Body) == 0 || !strings.Contains(att.Content.Body[0].Text, "Day 14 camera cards - done") {
		t.Errorf("adaptive card missing summary title: %+v", att.Content.Body)
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
