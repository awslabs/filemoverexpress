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

		// IsUpload controls how the destination renders (an s3:// URI for uploads,
		// a local path for downloads). Stats are included only when HasStats is set.
		IsUpload         bool
		HasStats         bool
		FilesTransferred int
		FilesSkipped     int
		FilesErrored     int
		BytesTransferred int64
		BytesSkipped     int64
		BytesErrored     int64
		Duration         time.Duration
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
	if dest := p.destinationDisplay(); dest != "" {
		fmt.Fprintf(&b, "\nDestination: %s", dest)
	}
	if p.HasStats {
		fmt.Fprintf(&b, "\n%d %s transferred (%s)",
			p.FilesTransferred, plural(p.FilesTransferred, "file", "files"), humanBytes(p.BytesTransferred))
		if p.FilesSkipped > 0 {
			fmt.Fprintf(&b, "\n%d skipped (%s)", p.FilesSkipped, humanBytes(p.BytesSkipped))
		}
		if p.FilesErrored > 0 {
			fmt.Fprintf(&b, "\n%d errored (%s)", p.FilesErrored, humanBytes(p.BytesErrored))
		}
		if p.Duration > 0 && p.BytesTransferred > 0 {
			fmt.Fprintf(&b, "\nAverage speed: %s", humanRate(p.BytesTransferred, p.Duration))
		}
	}
	if p.Detail != "" {
		b.WriteString("\n" + p.Detail)
	}
	if p.Host != "" {
		fmt.Fprintf(&b, "\nHost: %s", p.Host)
	}
	return b.String()
}

// destinationDisplay renders a clean target: an s3:// URI for uploads (a single
// bucket/prefix join with no doubled slashes), or the local path for downloads.
func (p Payload) destinationDisplay() string {
	if p.IsUpload {
		if p.Bucket == "" {
			return ""
		}
		prefix := strings.Trim(p.Prefix, "/")
		if prefix == "" {
			return "s3://" + p.Bucket + "/"
		}
		return "s3://" + p.Bucket + "/" + prefix + "/"
	}
	return p.Prefix
}

func plural(n int, one, many string) string {
	if n == 1 {
		return one
	}
	return many
}

// humanBytes formats a byte count with decimal (SI) units, matching how FME
// reports sizes elsewhere (kB, MB, GB).
func humanBytes(n int64) string {
	const unit = 1000
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	div, exp := int64(unit), 0
	for v := n / unit; v >= unit; v /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(n)/float64(div), "kMGTPE"[exp])
}

func humanRate(bytes int64, d time.Duration) string {
	if d <= 0 {
		return ""
	}
	return humanBytes(int64(float64(bytes)/d.Seconds())) + "/s"
}

func (p Payload) customBody() map[string]interface{} {
	event := "transfer.finished"
	if p.Outcome == OutcomeFailed {
		event = "transfer.failed"
	}
	body := map[string]interface{}{
		"event":      event,
		"job":        p.JobName,
		"status":     p.Outcome.status(),
		"bucket":     p.Bucket,
		"prefix":     p.Prefix,
		"host":       p.Host,
		"finishedAt": p.FinishedAt.UTC().Format(time.RFC3339),
	}
	if p.HasStats {
		body["filesTransferred"] = p.FilesTransferred
		body["filesSkipped"] = p.FilesSkipped
		body["filesErrored"] = p.FilesErrored
		body["bytesTransferred"] = p.BytesTransferred
		body["bytesSkipped"] = p.BytesSkipped
		body["bytesErrored"] = p.BytesErrored
		body["durationSeconds"] = int64(p.Duration.Seconds())
	}
	return body
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
