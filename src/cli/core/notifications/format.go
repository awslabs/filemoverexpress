package notifications

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

// Outcome is how a job ended, as reflected in the notification message.
const (
	// OutcomeSuccess means the job completed with no task errors.
	OutcomeSuccess Outcome = iota
	// OutcomePartial means the job completed but some files failed.
	OutcomePartial
	// OutcomeFailed means the job did not complete.
	OutcomeFailed
)

type (
	// Outcome enumerates how a job ended.
	Outcome int

	// Payload is the non-sensitive data a message is built from. It never carries
	// AWS account IDs or ARNs - bucket and prefix names only.
	Payload struct {
		JobName    string
		Outcome    Outcome
		Bucket     string
		Prefix     string
		Host       string
		Detail     string
		FinishedAt time.Time
	}
)

func (o Outcome) label() string {
	switch o {
	case OutcomeSuccess:
		return "done"
	case OutcomePartial:
		return "done with errors"
	case OutcomeFailed:
		return "failed"
	default:
		return "finished"
	}
}

func (o Outcome) status() string {
	if o == OutcomeFailed {
		return "failed"
	}
	return "success"
}

func (p Payload) summary() string {
	return fmt.Sprintf("%s - %s", p.JobName, p.Outcome.label())
}

func (p Payload) text() string {
	var b strings.Builder
	b.WriteString(p.summary())
	if p.Bucket != "" {
		fmt.Fprintf(&b, "\nDestination: %s/%s", p.Bucket, p.Prefix)
	}
	if p.Detail != "" {
		b.WriteString("\n" + p.Detail)
	}
	if p.Host != "" {
		fmt.Fprintf(&b, "\nHost: %s", p.Host)
	}
	return b.String()
}

func (p Payload) customBody() map[string]interface{} {
	event := "transfer.finished"
	if p.Outcome == OutcomeFailed {
		event = "transfer.failed"
	}
	return map[string]interface{}{
		"event":      event,
		"job":        p.JobName,
		"status":     p.Outcome.status(),
		"bucket":     p.Bucket,
		"prefix":     p.Prefix,
		"host":       p.Host,
		"finishedAt": p.FinishedAt.UTC().Format(time.RFC3339),
	}
}

// encodeBody renders the preset-specific JSON body FME posts to the webhook.
func encodeBody(preset configtypes.NotificationPreset, p Payload) ([]byte, error) {
	text := p.text()
	switch fmev1.NotificationPreset(preset) {
	case fmev1.NotificationPreset_NOTIFICATION_PRESET_DISCORD:
		return json.Marshal(map[string]string{"content": text})
	case fmev1.NotificationPreset_NOTIFICATION_PRESET_TEAMS:
		return json.Marshal(map[string]interface{}{
			"@type":    "MessageCard",
			"@context": "https://schema.org/extensions",
			"summary":  p.summary(),
			"text":     text,
		})
	case fmev1.NotificationPreset_NOTIFICATION_PRESET_CUSTOM_JSON:
		return json.Marshal(p.customBody())
	default:
		// Slack and Google Chat both accept a simple {"text": ...} body.
		return json.Marshal(map[string]string{"text": text})
	}
}
