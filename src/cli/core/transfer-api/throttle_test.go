package transfer_api

import (
	"context"
	"testing"
	"time"
)

// resetThrottle restores the unlimited default so tests do not leak state into
// one another (the limiter is package-global).
func resetThrottle() {
	SetTargetBPS(0)
}

func TestThrottle_DisabledIsNoOp(t *testing.T) {
	resetThrottle()
	defer resetThrottle()

	if IsThrottled() {
		t.Fatal("throttling should be disabled after SetTargetBPS(0)")
	}

	start := time.Now()
	if err := throttle(context.Background(), 500*1024*1024); err != nil {
		t.Fatalf("throttle returned error while disabled: %v", err)
	}
	if elapsed := time.Since(start); elapsed > 50*time.Millisecond {
		t.Fatalf("disabled throttle should return immediately, took %v", elapsed)
	}
}

func TestThrottle_EnablesAndDisables(t *testing.T) {
	resetThrottle()
	defer resetThrottle()

	SetTargetBPS(10 * 1024 * 1024)
	if !IsThrottled() {
		t.Fatal("throttling should be enabled after a positive SetTargetBPS")
	}

	SetTargetBPS(0)
	if IsThrottled() {
		t.Fatal("throttling should be disabled after SetTargetBPS(0)")
	}
}

func TestThrottle_LimitsRate(t *testing.T) {
	resetThrottle()
	defer resetThrottle()

	// 10 MiB/s cap => burst is 10 MiB. The first burst is free; asking for an
	// extra tenth of a second of tokens on top should block for roughly 100ms.
	const mib = 1024 * 1024
	SetTargetBPS(10 * mib)

	start := time.Now()
	if err := throttle(context.Background(), 11*mib); err != nil {
		t.Fatalf("throttle returned error: %v", err)
	}
	elapsed := time.Since(start)

	// Expect ~100ms; allow a generous window for slow CI while still proving a
	// real delay occurred (guards against the request being served instantly).
	if elapsed < 50*time.Millisecond || elapsed > 500*time.Millisecond {
		t.Fatalf("expected ~100ms delay for 11 MiB over 10 MiB/s cap, got %v", elapsed)
	}
}

func TestThrottle_SplitsRequestLargerThanBurst(t *testing.T) {
	resetThrottle()
	defer resetThrottle()

	// A single request far larger than the bucket must not error (WaitN would
	// reject n > burst); throttle() splits it into bucket-sized pieces.
	const mib = 1024 * 1024
	SetTargetBPS(5 * mib)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// 5 MiB burst is free, then 5 MiB more takes ~1s; well within the timeout.
	if err := throttle(ctx, 10*mib); err != nil {
		t.Fatalf("throttle should split large requests, got error: %v", err)
	}
}

func TestThrottle_ContextCancelUnblocks(t *testing.T) {
	resetThrottle()
	defer resetThrottle()

	const mib = 1024 * 1024
	SetTargetBPS(1 * mib) // 1 MiB/s: a 10 MiB request would otherwise wait ~9s

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // already cancelled

	start := time.Now()
	err := throttle(ctx, 10*mib)
	if err == nil {
		t.Fatal("expected throttle to return an error for a cancelled context")
	}
	if elapsed := time.Since(start); elapsed > 200*time.Millisecond {
		t.Fatalf("cancelled context should unblock quickly, took %v", elapsed)
	}
}
