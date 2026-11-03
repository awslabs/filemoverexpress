package transfer_api

import (
	"errors"
	"math/rand"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/ratelimit"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
)

// Buffer-pressure backoff bounds. When a write fails with "no buffer space
// available" (ENOBUFS / WSAENOBUFS) the kernel network pool is momentarily full;
// the only useful response is to wait for in-flight transfers to drain it before
// retrying, not to retry immediately. These delays are deliberately longer than
// the SDK's default connection-error backoff (base 50ms) so the pool has real
// time to recover under a burst of simultaneous failures.
const (
	enobufsBaseBackoff = 250 * time.Millisecond
	enobufsMaxBackoff  = 5 * time.Second
	// enobufsMinAttempts is the floor on retry attempts when buffer pressure is
	// possible. Each attempt is one backoff cycle that lets the pool drain, so a
	// few extra attempts matter far more here than for a normal transient error.
	enobufsMinAttempts = 10
)

// enobufsBackoff is a BackoffDelayer that applies a long, jittered delay to
// buffer-exhaustion errors so the kernel pool can drain between attempts, and
// delegates every other error to the SDK's standard exponential-jitter backoff.
type enobufsBackoff struct {
	standard retry.BackoffDelayer
}

// isNoBufferSpace reports whether err was caused by kernel network-buffer
// exhaustion, unwrapping the net/os/syscall error chain.
func isNoBufferSpace(err error) bool {
	return err != nil && errors.Is(err, errNoBufferSpace)
}

func (b enobufsBackoff) BackoffDelay(attempt int, err error) (time.Duration, error) {
	if !isNoBufferSpace(err) {
		return b.standard.BackoffDelay(attempt, err)
	}
	// Exponential: base * 2^(attempt-1), capped, with full jitter.
	d := enobufsBaseBackoff << uint(max(attempt-1, 0))
	if d > enobufsMaxBackoff || d <= 0 {
		d = enobufsMaxBackoff
	}
	//nolint:gosec // jitter does not need a cryptographic RNG
	return time.Duration(rand.Int63n(int64(d))) + enobufsBaseBackoff, nil
}

// newENOBUFSRetryer returns a Retryer that treats kernel buffer exhaustion as a
// first-class retryable condition: it adds an explicit ENOBUFS classifier, gives
// those errors a long drain-and-retry backoff, and disables the client-side retry
// rate limiter so a burst of simultaneous ENOBUFS failures backs off and retries
// under MaxAttempts instead of instantly draining the shared token bucket and
// hard-failing with "retry quota exceeded" (the failure observed at MTU 1500).
//
// baseAttempts is the configured retry count; the retryer uses at least
// enobufsMinAttempts so buffer pressure gets several drain cycles.
func newENOBUFSRetryer(baseAttempts int) aws.Retryer {
	attempts := max(baseAttempts, enobufsMinAttempts)
	return retry.NewStandard(func(o *retry.StandardOptions) {
		o.MaxAttempts = attempts
		// Treat ENOBUFS as retryable explicitly (the default connection-error
		// classifier usually also catches it, but being explicit guarantees the
		// long backoff path and documents intent).
		o.Retryables = append(o.Retryables, retry.IsErrorRetryableFunc(func(err error) aws.Ternary {
			if isNoBufferSpace(err) {
				return aws.TrueTernary
			}
			return aws.UnknownTernary
		}))
		// Wrap the configured backoff so ENOBUFS gets the long drain delay.
		o.Backoff = enobufsBackoff{standard: retry.NewExponentialJitterBackoff(o.MaxBackoff)}
		// Remove the token-bucket cap. Under a burst of concurrent ENOBUFS the
		// default 500-token bucket (5/retry) empties in milliseconds and surfaces
		// as "retry quota exceeded", hard-failing files that backoff would have
		// recovered. MaxAttempts + the long backoff now govern retry volume.
		o.RateLimiter = ratelimit.None
	})
}
