package checksum_manager

import (
	"sync"

	mhlProcessor "github.com/awslabs/filemoverexpress/core/checksums/checksum-manager/mhl-processor"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/utils/safeconv"
)

func (cm *ChecksumManager) ChecksumTasks(jobId string, tasks []*jobmanagertypes.Task, checksumSettings configtypes.ChecksumSettings) {
	if !checksumSettings.Enabled {
		return
	}

	mhlResults, mhlErrors := mhlProcessor.ProcessMHLFiles(tasks, checksumSettings.Algorithm)
	if len(mhlErrors) > 0 {
		for _, err := range mhlErrors {
			events.Events.Warn("Failed processing MHL file: %s", err)
		}
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
		return
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
}
