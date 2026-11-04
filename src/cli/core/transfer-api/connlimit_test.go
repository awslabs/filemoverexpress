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
