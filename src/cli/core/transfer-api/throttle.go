package transfer_api

import (
	"context"
	"sync"
	"sync/atomic"

	"golang.org/x/time/rate"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/constants"
)

// Transfer throttling is implemented with a token-bucket rate limiter
// (golang.org/x/time/rate). A single limiter meters the bytes each transfer
// worker requests to read (uploads) or write (downloads), charged up front per
// operation, so the configured Target Bandwidth is an aggregate cap on how fast
// FME moves data regardless of how many transfer workers are running or whether
// uploads and downloads happen at the same time. Because a read can return
// fewer bytes than requested (short reads, EOF tail), the limiter may debit
// slightly more than is actually moved; the cap therefore behaves as a
// conservative ceiling that can sit a hair under target rather than overshoot
// it. A target of 0 disables throttling entirely.
var (
	// throttleMu guards limiter. rate.Limiter is itself safe for concurrent
	// use; the lock only protects swapping the limiter out (on/off) and
	// re-targeting it when the configuration changes.
	throttleMu sync.RWMutex
	limiter    *rate.Limiter

	// throttlingEnabled is a lock-free fast path so the common unlimited case
	// costs a single atomic load per read/write instead of taking the lock.
	throttlingEnabled atomic.Bool
)

// InitThrottling initializes the transfer rate limiter from configuration.
func InitThrottling() {
	SetTargetBPS(int64(config.LoadConfiguration().General.TargetBandwidth) * constants.MiB)
}

// SetTargetBPS sets the aggregate transfer rate cap in bytes per second. A value
// of 0 or less disables throttling. Safe to call at runtime when configuration
// changes; in-flight transfers pick up the new rate on their next chunk.
func SetTargetBPS(bps int64) {
	throttleMu.Lock()
	defer throttleMu.Unlock()

	if bps <= 0 {
		limiter = nil
		throttlingEnabled.Store(false)
		return
	}

	// Burst is one second of tokens. It also bounds the largest single WaitN
	// request; throttle() splits anything larger so WaitN never rejects an
	// oversized read (WaitN fails when n exceeds the bucket depth). The useful
	// burst floor is effectively one part size: if a part read exceeds one
	// second of tokens (e.g. a 16 MiB part under a 10 MiB/s cap) it is split
	// across multiple WaitN calls and no single part clears in one wait. That
	// is the intended cap behavior, but a future tuner should keep burst and
	// part size related.
	burst := int(bps)
	if limiter == nil {
		limiter = rate.NewLimiter(rate.Limit(bps), burst)
	} else {
		limiter.SetLimit(rate.Limit(bps))
		limiter.SetBurst(burst)
	}
	throttlingEnabled.Store(true)
}

// IsThrottled reports whether a transfer rate cap is currently in effect.
func IsThrottled() bool {
	return throttlingEnabled.Load()
}

// throttle blocks until n bytes may be transferred under the current rate cap.
// It is a no-op when throttling is disabled. Requests larger than the bucket
// depth are split into bucket-sized pieces so WaitN never rejects them. It
// returns ctx.Err() if ctx is cancelled while waiting, which lets a paused or
// cancelled transfer unblock immediately.
func throttle(ctx context.Context, n int) error {
	if !throttlingEnabled.Load() || n <= 0 {
		return nil
	}

	throttleMu.RLock()
	l := limiter
	throttleMu.RUnlock()
	if l == nil {
		return nil
	}

	if ctx == nil {
		ctx = context.Background()
	}

	for n > 0 {
		// Re-read burst every iteration. SetTargetBPS can shrink it at runtime
		// on a live Target Bandwidth decrease, and WaitN rejects any chunk that
		// exceeds the limiter's current burst. Reading it once up front would
		// let a mid-transfer cap decrease size a chunk against a stale (larger)
		// burst and surface as a spurious "exceeds burst" transfer error.
		burst := l.Burst()
		chunk := n
		if burst > 0 && chunk > burst {
			chunk = burst
		}
		if err := l.WaitN(ctx, chunk); err != nil {
			return err
		}
		n -= chunk
	}
	return nil
}
