package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/awslabs/filemoverexpress/core/notifications"
)

func TestClientSafeNotifyMessage(t *testing.T) {
	const generic = "generic fallback"

	// A plain error (e.g. an Upsert failure carrying a filesystem path) must not
	// reach the client - it falls back to the generic message.
	storeErr := errors.New("open /Users/someone/.fme/secrets/dest.enc: permission denied")
	if msg := clientSafeNotifyMessage(storeErr, generic); msg != generic {
		t.Fatalf("plain error should fall back to generic, got %q", msg)
	}

	// A public, user-fixable validation error returns its own safe text.
	schemeErr := notifications.ValidateWebhookURL(context.Background(), "http://hooks.slack.com/x")
	if msg := clientSafeNotifyMessage(schemeErr, generic); msg != "webhook url must use https" {
		t.Fatalf("public error should return its own message, got %q", msg)
	}

	// A sanitized public error (internal host) returns the sanitized text and
	// never the resolved private IP - this is the leak finding #2 closed.
	internalErr := notifications.ValidateWebhookURL(context.Background(), "https://10.0.0.5/hook")
	msg := clientSafeNotifyMessage(internalErr, generic)
	if msg == generic {
		t.Fatal("sanitized public error should return its public message, not the generic fallback")
	}
	if strings.Contains(msg, "10.0.0.5") {
		t.Fatalf("client message leaked the resolved IP: %q", msg)
	}
}
