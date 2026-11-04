package transfer_api

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/awslabs/filemoverexpress/constants"
)

func TestHostPoolBytes(t *testing.T) {
	assert.Equal(t, 512*constants.MiB, HostPoolBytes("darwin"))
	assert.Equal(t, int64(0), HostPoolBytes("linux"))
	assert.Equal(t, int64(0), HostPoolBytes("windows"))
}

func TestConnectionBudget(t *testing.T) {
	// macOS pool at a 1 MiB send buffer: 512 MiB * 60% / 1 MiB = 307 sockets.
	assert.Equal(t, 307, ConnectionBudget(512*constants.MiB, constants.MiB))
	// A 2 MiB buffer roughly halves the budget.
	assert.Equal(t, 153, ConnectionBudget(512*constants.MiB, 2*constants.MiB))
	// A 512 KiB buffer would exceed the ceiling, so it clamps.
	assert.Equal(t, 512, ConnectionBudget(512*constants.MiB, 512*constants.KiB))
	// Elastic pool (Linux) or no send-buffer cap -> ceiling.
	assert.Equal(t, 512, ConnectionBudget(0, constants.MiB))
	assert.Equal(t, 512, ConnectionBudget(512*constants.MiB, 0))
}

func TestPlanForSize(t *testing.T) {
	cases := []struct {
		name        string
		size        int64
		wantThreads int
	}{
		{"tiny 2MiB -> 1 thread", 2 * constants.MiB, 1},
		{"small 40MiB -> 8 threads", 40 * constants.MiB, 8},
		{"medium 128MiB -> 16 threads", 128 * constants.MiB, 16},
		{"large 1GiB -> 24 threads", 1024 * constants.MiB, 24},
		{"xlarge 3GiB -> 32 threads", 3072 * constants.MiB, 32},
		{"huge 48GiB -> 48 threads", 48 * constants.GiB, 48},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			plan := PlanForSize(tc.size, 512)
			assert.Equal(t, tc.wantThreads, plan.Threads)
			assert.GreaterOrEqual(t, plan.ChunkSize, int64(minChunk))
			assert.LessOrEqual(t, plan.ChunkSize, int64(maxChunk))
			// Regression guard: a file must have at least as many parts as threads,
			// or the threads do nothing (the 40 MiB -> 2 parts bug).
			parts := int((tc.size + plan.ChunkSize - 1) / plan.ChunkSize)
			assert.GreaterOrEqual(t, parts, plan.Threads)
		})
	}
}

func TestPlanForSizeClampsToBudget(t *testing.T) {
	// A huge file would want 48 threads, but a tiny budget caps it so it can never
	// request more sockets than the whole budget.
	plan := PlanForSize(48*constants.GiB, 8)
	assert.Equal(t, 8, plan.Threads)
}
