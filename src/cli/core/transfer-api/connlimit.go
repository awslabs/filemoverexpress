package transfer_api

import (
	"context"
	"sync"
	"sync/atomic"

	"golang.org/x/sync/semaphore"
)

// Process-global weighted connection limiter. Each in-flight file acquires tokens
// equal to its planned thread count before uploading and releases them when done,
// so the SUM of all files' threads never exceeds the budget. This is the shared
// ceiling the workers-times-threads model lacked: small files (few tokens) pack in
// while large files (more tokens) run fewer-at-once, with no user knob.

var (
	connectionLimiter atomic.Pointer[semaphore.Weighted]
	configuredBudget  atomic.Int64
	loggedPlanThreads sync.Map // thread-count -> struct{}; dedups diagnostic plan logging
)

// ConfigureConnectionLimiter installs a global limiter of the given budget, or
// disables limiting when budget <= 0. Called once at daemon start; replacing the
// limiter is safe because the pointer swap is atomic.
func ConfigureConnectionLimiter(budget int) {
	loggedPlanThreads.Clear()
	if budget <= 0 {
		connectionLimiter.Store(nil)
		configuredBudget.Store(0)
		return
	}
	connectionLimiter.Store(semaphore.NewWeighted(int64(budget)))
	configuredBudget.Store(int64(budget))
}

// ConfiguredBudget returns the active connection budget, or 0 when adaptive
// limiting is off. A positive value is the signal that adaptive mode is engaged.
func ConfiguredBudget() int {
	return int(configuredBudget.Load())
}

// ShouldLogPlan reports whether a per-file plan with this thread count has not yet
// been logged this daemon run, recording it so each distinct size tier logs once.
// Keeps the adaptive diagnostic to a few lines even on jobs with thousands of files.
func ShouldLogPlan(threads int) bool {
	_, loaded := loggedPlanThreads.LoadOrStore(threads, struct{}{})
	return !loaded
}

// acquireConnections blocks until n tokens are free (or ctx is done) and returns a
// release func the caller MUST invoke exactly once. It is a no-op when no limiter
// is configured or n <= 0. PlanForSize clamps n to the budget, so n never exceeds
// capacity (which would otherwise block until cancellation).
func acquireConnections(ctx context.Context, n int) (func(), error) {
	lim := connectionLimiter.Load()
	if lim == nil || n <= 0 {
		return func() {}, nil
	}
	if err := lim.Acquire(ctx, int64(n)); err != nil {
		return func() {}, err
	}
	return func() { lim.Release(int64(n)) }, nil
}
