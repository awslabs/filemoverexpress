package transfer_api

import (
	"errors"
	"fmt"
	"net"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws/retry"
)

func TestIsNoBufferSpace(t *testing.T) {
	t.Run("direct errno matches", func(t *testing.T) {
		if !isNoBufferSpace(errNoBufferSpace) {
			t.Fatal("expected direct errNoBufferSpace to match")
		}
	})

	t.Run("wrapped errno matches", func(t *testing.T) {
		// Mirrors the real chain: net.OpError wrapping an os.SyscallError
		// wrapping the errno, further wrapped by the uploader's %w.
		wrapped := fmt.Errorf("upload multipart failed: %w",
			&net.OpError{Op: "write", Net: "tcp", Err: errNoBufferSpace})
		if !isNoBufferSpace(wrapped) {
			t.Fatal("expected wrapped errNoBufferSpace to match")
		}
	})

	t.Run("nil does not match", func(t *testing.T) {
		if isNoBufferSpace(nil) {
			t.Fatal("nil should not match")
		}
	})

	t.Run("unrelated error does not match", func(t *testing.T) {
		if isNoBufferSpace(errors.New("connection reset by peer")) {
			t.Fatal("unrelated error should not match")
		}
	})
}

func TestENOBUFSBackoff(t *testing.T) {
	b := enobufsBackoff{standard: retry.NewExponentialJitterBackoff(enobufsMaxBackoff)}

	t.Run("enobufs gets at least the base delay", func(t *testing.T) {
		for attempt := 1; attempt <= 6; attempt++ {
			d, err := b.BackoffDelay(attempt, errNoBufferSpace)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if d < enobufsBaseBackoff {
				t.Fatalf("attempt %d: delay %v below base %v", attempt, d, enobufsBaseBackoff)
			}
			if d > enobufsMaxBackoff+enobufsBaseBackoff {
				t.Fatalf("attempt %d: delay %v exceeds cap", attempt, d)
			}
		}
	})

	t.Run("non-enobufs delegates to standard", func(t *testing.T) {
		// Standard backoff must still return a sane, bounded delay.
		d, err := b.BackoffDelay(1, errors.New("some transient error"))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if d < 0 || d > enobufsMaxBackoff {
			t.Fatalf("standard delay %v out of expected range", d)
		}
	})
}

func TestNewENOBUFSRetryer(t *testing.T) {
	t.Run("honors the configured attempt count", func(t *testing.T) {
		r := newENOBUFSRetryer(3)
		if got := r.MaxAttempts(); got != 3 {
			t.Fatalf("MaxAttempts = %d, want 3 (configured retryCount governs all classes)", got)
		}
	})

	t.Run("honors a higher configured count", func(t *testing.T) {
		r := newENOBUFSRetryer(50)
		if got := r.MaxAttempts(); got != 50 {
			t.Fatalf("MaxAttempts = %d, want 50", got)
		}
	})

	t.Run("classifies enobufs as retryable", func(t *testing.T) {
		r := newENOBUFSRetryer(10)
		wrapped := &net.OpError{Op: "write", Net: "tcp", Err: errNoBufferSpace}
		if !r.IsErrorRetryable(wrapped) {
			t.Fatal("expected ENOBUFS to be retryable")
		}
	})

	// Guard the backoff path end-to-end through the retryer's delay.
	t.Run("retryer delay is bounded", func(t *testing.T) {
		r := newENOBUFSRetryer(10)
		d, err := r.RetryDelay(2, errNoBufferSpace)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if d <= 0 || d > enobufsMaxBackoff+enobufsBaseBackoff+time.Second {
			t.Fatalf("retry delay %v out of expected range", d)
		}
	})
}
