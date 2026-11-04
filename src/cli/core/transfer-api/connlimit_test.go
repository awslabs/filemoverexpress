package transfer_api

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/types/configtypes"
)

func TestConnectionLimiterDisabled(t *testing.T) {
	ConfigureConnectionLimiter(0)
	assert.Equal(t, 0, ConfiguredBudget())
	release, err := acquireConnections(context.Background(), 10)
	require.NoError(t, err)
	release() // no-op, must not panic
}

func TestConnectionLimiterBoundsBudget(t *testing.T) {
	ConfigureConnectionLimiter(8)
	t.Cleanup(func() { ConfigureConnectionLimiter(0) })
	assert.Equal(t, 8, ConfiguredBudget())

	rel1, err := acquireConnections(context.Background(), 8)
	require.NoError(t, err)

	// Budget exhausted: a further acquire with an already-cancelled context errors
	// instead of over-committing the pool.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = acquireConnections(ctx, 1)
	assert.Error(t, err)

	// After releasing, the full budget is available again.
	rel1()
	rel2, err := acquireConnections(context.Background(), 8)
	require.NoError(t, err)
	rel2()
}

func TestConfigureAdaptiveFromConfig(t *testing.T) {
	t.Cleanup(func() { ConfigureConnectionLimiter(0) })

	off := configtypes.FmeConfig{}
	assert.Equal(t, 0, ConfigureAdaptiveFromConfig(off, "darwin"))

	// macOS, adaptive on, no explicit buffer -> 1 MiB default -> ~307 budget.
	on := configtypes.FmeConfig{}
	on.General.AdaptiveConcurrency = true
	assert.Equal(t, 307, ConfigureAdaptiveFromConfig(on, "darwin"))
	assert.Equal(t, 307, ConfiguredBudget())

	// Explicit 2 MiB buffer halves the budget.
	on.General.SendBufferBytes = int32(2 * constants.MiB)
	assert.Equal(t, 153, ConfigureAdaptiveFromConfig(on, "darwin"))

	// Linux: elastic pool -> ceiling budget.
	linux := configtypes.FmeConfig{}
	linux.General.AdaptiveConcurrency = true
	assert.Equal(t, 512, ConfigureAdaptiveFromConfig(linux, "linux"))

	// An explicit maxConnectionsPerHost caps the adaptive budget below the ceiling.
	linux.General.MaxConnectionsPerHost = 256
	assert.Equal(t, 256, ConfigureAdaptiveFromConfig(linux, "linux"))

	// A cap above the pool-derived value does not raise it (macOS stays 307).
	raise := configtypes.FmeConfig{}
	raise.General.AdaptiveConcurrency = true
	raise.General.MaxConnectionsPerHost = 999
	assert.Equal(t, 307, ConfigureAdaptiveFromConfig(raise, "darwin"))
}

func TestAcquireAdaptivePlanDisabled(t *testing.T) {
	ConfigureConnectionLimiter(0)
	acq, err := AcquireAdaptivePlan(context.Background(), 1024*constants.MiB, "upload")
	require.NoError(t, err)
	assert.False(t, acq.Engaged)
	assert.NotNil(t, acq.Release)
	acq.Release() // no-op, must not panic
}

func TestAcquireAdaptivePlanEngaged(t *testing.T) {
	ConfigureConnectionLimiter(512)
	t.Cleanup(func() { ConfigureConnectionLimiter(0) })

	// A 1 GiB file should plan to the large tier (24 threads) and acquire that many.
	acq, err := AcquireAdaptivePlan(context.Background(), 1024*constants.MiB, "download")
	require.NoError(t, err)
	assert.True(t, acq.Engaged)
	want := PlanForSize(1024*constants.MiB, 512)
	assert.Equal(t, want, acq.Plan)

	// The plan's threads are now held. Acquiring exactly the remaining budget
	// (512 - plan.Threads) must succeed, which proves the plan's tokens were actually
	// taken: if they had not been, the full 512 would still be free.
	relRest, err := acquireConnections(context.Background(), 512-want.Threads)
	require.NoError(t, err)

	// Budget is now exhausted: a further acquire with an already-cancelled context
	// errors instead of over-committing.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = acquireConnections(ctx, 1)
	assert.Error(t, err)

	// After releasing both, the full budget is available again.
	relRest()
	acq.Release()
	rel, err := acquireConnections(context.Background(), 512)
	require.NoError(t, err)
	rel()
}

func TestAcquireAdaptivePlanAbortedDuringWait(t *testing.T) {
	ConfigureConnectionLimiter(8)
	t.Cleanup(func() { ConfigureConnectionLimiter(0) })

	// Exhaust the budget so the next acquire must wait.
	hold, err := acquireConnections(context.Background(), 8)
	require.NoError(t, err)
	defer hold()

	// A plan that needs tokens, with an already-cancelled context, returns an error
	// and Engaged=false, so a caller creates no output file.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	acq, err := AcquireAdaptivePlan(ctx, 1024*constants.MiB, "download")
	assert.Error(t, err)
	assert.False(t, acq.Engaged)
	assert.NotNil(t, acq.Release)
	acq.Release() // no-op, must not panic
}
