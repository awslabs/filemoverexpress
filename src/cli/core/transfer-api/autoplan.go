package transfer_api

import "github.com/awslabs/filemoverexpress/constants"

// Adaptive, pool-aware concurrency planning (POC, opt-in).
//
// FME's live S3 connection count is workers (files in flight) times per-file
// multipart threads, and nothing bounds that product. On a host with a fixed
// kernel socket-buffer pool (macOS at MTU 1500) the product can overrun the pool
// and lose files. These pure helpers split the problem in two:
//
//   - per-file: threads follow the file SIZE (how much one file can parallelize),
//     paired with a chunk of size/threads so the threads are actually usable (a
//     coarse fixed chunk collapses a 40 MB file to 2 parts and wastes its threads);
//   - cross-file: a shared weighted limiter (connlimit.go) bounds the SUM of all
//     in-flight files' threads to an OS-aware budget, which is where pool size is
//     enforced. Small files take few threads so many pack in; large files take more
//     each so fewer run at once.

const (
	// macOSKernelPoolBytes is the fixed Apple-Silicon kernel network memory pool
	// (~512 MiB, not raisable without lowering startup security). MTU-1500 uploads
	// lose files once send buffers across all sockets approach it.
	macOSKernelPoolBytes = 512 * constants.MiB

	// budgetSafetyPct leaves headroom for receive buffers and MTU-1500 packet
	// clusters, which draw on the same pool as send buffers. pctBase is its divisor.
	budgetSafetyPct int64 = 60
	pctBase         int64 = 100

	// Socket-budget clamps.
	connectionBudgetFloor   = 16
	connectionBudgetCeiling = 512

	// Per-file thread targets by size. A file parallelizes within itself only up to
	// its part count, so each pairs with a chunk = size/threads (clamped) to keep the
	// threads usable. Values are generous for a large pool; the shared limiter caps
	// how many files run at once, which is where the OS pool size is enforced.
	threadsTiny   = 1
	threadsSmall  = 8
	threadsMedium = 16
	threadsLarge  = 24
	threadsXLarge = 32
	threadsHuge   = 48

	// File-size tier boundaries.
	sizeTinyMax   = 16 * constants.MiB
	sizeSmallMax  = 64 * constants.MiB
	sizeMediumMax = 256 * constants.MiB
	sizeLargeMax  = 1024 * constants.MiB
	sizeXLargeMax = 4096 * constants.MiB

	// Chunk clamp. The floor is S3's 5 MiB multipart minimum; the ceiling keeps part
	// counts and per-part memory sane on very large files.
	minChunk = 5 * constants.MiB
	maxChunk = 64 * constants.MiB
)

// ConcurrencyPlan is the per-file multipart setting the adaptive planner chose.
type ConcurrencyPlan struct {
	Threads   int
	ChunkSize int64
}

// HostPoolBytes returns the fixed kernel network pool for the OS, or 0 when the
// pool is effectively elastic (Linux/Windows) and the budget should fall back to
// the ceiling. Pure: the caller passes runtime.GOOS.
func HostPoolBytes(goos string) int64 {
	if goos == "darwin" {
		return macOSKernelPoolBytes
	}
	return 0
}

// ConnectionBudget returns the maximum simultaneous S3 sockets that fit in the
// host network pool at the given per-socket send-buffer size, with headroom.
// poolBytes <= 0 (elastic pool) or sendBufferBytes <= 0 (no cap, so the pool math
// does not apply) both fall back to the ceiling.
func ConnectionBudget(poolBytes, sendBufferBytes int64) int {
	if poolBytes <= 0 || sendBufferBytes <= 0 {
		return connectionBudgetCeiling
	}
	budget := int((poolBytes * budgetSafetyPct / pctBase) / sendBufferBytes)
	if budget > connectionBudgetCeiling {
		return connectionBudgetCeiling
	}
	if budget < connectionBudgetFloor {
		return connectionBudgetFloor
	}
	return budget
}

// PlanForSize picks a per-file thread count and chunk size. Threads come from the
// file size; the chunk is size/threads clamped to [minChunk, maxChunk] so the file
// has at least as many parts as threads. Threads are then reduced to the actual
// part count (so none are idle) and clamped to the budget (so one file can never
// request more sockets than the whole budget, which would deadlock the limiter).
func PlanForSize(size int64, budget int) ConcurrencyPlan {
	threads := baseThreadsForSize(size)
	chunk := clampChunk(size / int64(threads))
	if parts := partCount(size, chunk); parts < threads {
		threads = parts
	}
	if threads < 1 {
		threads = 1
	}
	if budget > 0 && threads > budget {
		threads = budget
	}
	return ConcurrencyPlan{Threads: threads, ChunkSize: chunk}
}

// baseThreadsForSize maps a file size to its target thread count.
func baseThreadsForSize(size int64) int {
	switch {
	case size <= sizeTinyMax:
		return threadsTiny
	case size <= sizeSmallMax:
		return threadsSmall
	case size <= sizeMediumMax:
		return threadsMedium
	case size <= sizeLargeMax:
		return threadsLarge
	case size <= sizeXLargeMax:
		return threadsXLarge
	default:
		return threadsHuge
	}
}

// clampChunk bounds a candidate chunk size to [minChunk, maxChunk].
func clampChunk(c int64) int64 {
	if c < minChunk {
		return minChunk
	}
	if c > maxChunk {
		return maxChunk
	}
	return c
}

// partCount is the number of multipart parts for a size at a chunk (ceil, min 1).
func partCount(size, chunk int64) int {
	if chunk <= 0 {
		return 1
	}
	parts := int((size + chunk - 1) / chunk)
	if parts < 1 {
		return 1
	}
	return parts
}
