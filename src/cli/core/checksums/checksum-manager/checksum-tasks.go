package checksum_manager

import (
	"context"
	"path/filepath"
	"sync"

	mhlProcessor "github.com/awslabs/filemoverexpress/core/checksums/checksum-manager/mhl-processor"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/utils/safeconv"
)

// JobRef identifies the job a checksum pass belongs to, keeping ChecksumTasks
// within the argument-count limit.
type JobRef struct {
	ID   string
	Name string
}

// ChecksumTasks computes checksums for the job's tasks (when the profile enables
// checksums) and verifies any supplied ASC MHL manifest. ASC MHL verification
// runs REGARDLESS of the checksum setting - a manifest shipped with the media is
// honored even when checksums are off - and runs after the checksum pass so a
// file verified in the profile's own algorithm reuses the hash already computed
// instead of reading the file twice. Returns the number of ASC MHL integrity
// problems so the caller can mark the job COMPLETED_WITH_WARNINGS.
func (cm *ChecksumManager) ChecksumTasks(
	ctx context.Context,
	job JobRef,
	tasks []*jobmanagertypes.Task,
	checksumSettings configtypes.ChecksumSettings,
) int {
	var freshlyHashed map[string]string
	if checksumSettings.Enabled {
		freshlyHashed = cm.runChecksumPass(job.ID, tasks, checksumSettings)
	}

	return mhlProcessor.VerifyASCMHL(mhlProcessor.VerifyRequest{
		Ctx:              ctx,
		JobID:            job.ID,
		JobName:          job.Name,
		Tasks:            tasks,
		ProfileAlgorithm: checksumSettings.Algorithm,
		Precomputed:      freshlyHashed,
	})
}

// runChecksumPass imports legacy MHL / cached checksums and computes the rest
// through the worker pool, storing each result on its task. It returns the
// checksums it FRESHLY computed from file bytes in this pass (abs path ->
// checksum). Checksums imported from a legacy MHL or the cache are deliberately
// NOT included: ASC MHL verification must never reuse a hash that was not read
// from the current bytes, or a tampered file with a matching stale hash would
// pass verification.
func (cm *ChecksumManager) runChecksumPass(
	jobId string,
	tasks []*jobmanagertypes.Task,
	checksumSettings configtypes.ChecksumSettings,
) map[string]string {
	mhlResults, mhlErrors := mhlProcessor.ProcessMHLFiles(tasks, checksumSettings.Algorithm)
	for _, err := range mhlErrors {
		events.Events.Warn("Failed processing MHL file: %s", err)
	}

	taskCount := len(tasks)
	wg := &sync.WaitGroup{}

	// Safe conversion for checksum task count - Issue #15
	totalTasks, err := safeconv.IntToInt32(taskCount)
	if err != nil {
		logger.Error("Invalid task count %d for job %s: %v, using maximum safe value", taskCount, jobId, err)
		totalTasks = 2147483647 // math.MaxInt32
	}

	prog := checksumStatsRecord{
		jobId:     jobId,
		total:     totalTasks,
		completed: 0,
		wg:        wg,
	}

	reqs := make([]checksumRequest, 0)
	for _, task := range tasks {
		taskPath := task.LocalFile().Path
		if mhlChecksum, mhlFound := mhlResults[taskPath]; mhlFound {
			task.SetChecksum(mhlChecksum)
			prog.total--
			continue
		}

		if cacheChecksum, cacheFound := cm.isChecksumCached(task.LocalFile(), checksumSettings.Algorithm); cacheFound {
			task.SetChecksum(cacheChecksum)
			prog.total--
			continue
		}

		reqs = append(reqs, checksumRequest{
			jobId:     jobId,
			task:      task,
			algorithm: checksumSettings.Algorithm,
		})
	}

	if prog.total == 0 {
		events.Events.Send(&eventtypes.JobChecksumProgressEvent{
			JobId:     jobId,
			Total:     0,
			Completed: 0,
		})
		return nil
	}

	prog.wg.Add(int(prog.total))
	cm.statsLock.Lock()
	cm.stats[jobId] = &prog
	cm.statsLock.Unlock()

	for _, csr := range reqs {
		cm.work <- csr
	}

	prog.wg.Wait()
	events.Events.Send(&eventtypes.JobChecksumProgressEvent{
		JobId:     jobId,
		Total:     prog.total,
		Completed: prog.total,
	})
	cm.statsLock.Lock()
	delete(cm.stats, jobId)
	cm.statsLock.Unlock()

	return freshChecksums(reqs)
}

// freshChecksums collects the abs-path -> checksum map for the tasks that went
// through the worker pool (i.e. were hashed from bytes this pass). Tasks that
// errored have an empty checksum and are skipped.
func freshChecksums(reqs []checksumRequest) map[string]string {
	out := make(map[string]string, len(reqs))
	for _, r := range reqs {
		sum := r.task.Checksum()
		if sum == "" {
			continue
		}
		if abs, err := filepath.Abs(r.task.LocalFile().Path); err == nil {
			out[abs] = sum
		}
	}
	return out
}
