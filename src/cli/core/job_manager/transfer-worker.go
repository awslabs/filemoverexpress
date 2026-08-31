package job_manager

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync/atomic"
	"time"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/core"
	"github.com/awslabs/filemoverexpress/core/auth"
	transferapi "github.com/awslabs/filemoverexpress/core/transfer-api"
	"github.com/awslabs/filemoverexpress/events"
	fterrors "github.com/awslabs/filemoverexpress/fme-errors"
	"github.com/awslabs/filemoverexpress/types/databasetypes"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/utils/fs"
	"github.com/awslabs/filemoverexpress/utils/supportfile"
)

// createTransferWorker sits indefinitely and reads from the queue waiting for work.
func (jm *JobManager) createTransferWorker() {
	var task *jobmanagertypes.Task
	for {
		task = jm.getNextTask()
		for task == nil {
			time.Sleep(10 * time.Millisecond)
			task = jm.getNextTask()
		}
		jm.DoSingleTransfer(task)
	}
}

// finishTask records that a task has completed its lifecycle and decrements the
// job's WaitGroup exactly once, even if both the transfer worker and the cancel
// path attempt to finish the same task. See Task.MarkFinished.
func finishTask(job *jobmanagertypes.Job, task *jobmanagertypes.Task) {
	if task.MarkFinished() {
		job.WaitGroup.Done()
	}
}

// DoSingleTransfer handles the transfer of a task, updates task/job statuses, and updates the job waitgroup.
//
//revive:disable:function-length
func (jm *JobManager) DoSingleTransfer(task *jobmanagertypes.Task) {
	job := jm.GetJob(task.JobId())
	if job == nil {
		task.SetStatusAndError(jobmanagertypes.TaskStatusError, fmt.Errorf(strTaskWithUnknownJob, task.JobId()))
		return
	}

	jobStatus := job.Status()
	if jobStatus == jobmanagertypes.JobStatusError {
		finishTask(job, task)
		return
	}
	transferProfile := job.TransferProfile()
	if jobStatus != jobmanagertypes.JobStatusInProgress &&
		jobStatus != jobmanagertypes.JobStatusPaused &&
		jobStatus != jobmanagertypes.JobStatusCancelled {
		job.SetStatus(jobmanagertypes.JobStatusInProgress)
	}

	s3Manager, err := jm.GetS3Manager(transferProfile)
	if err != nil {
		events.Events.Send(&eventtypes.JobErrorEvent{
			Id:        job.JobId(),
			Name:      job.Name(),
			ErrorTime: time.Now(),
			Err:       err,
		})
		job.SetStatus(jobmanagertypes.JobStatusError)
		finishTask(job, task)
		return
	}
	task.SetStatus(jobmanagertypes.TaskStatusInProgress)
	err = TransferTask(task, job, s3Manager)
	//nolint:nestif
	if err != nil {
		if errors.Is(err, fterrors.ErrJobPaused) {
			task.SetStatus(jobmanagertypes.TaskStatusPaused)
			jm.priorityQueue.Push(task)
			return
		} else if errors.Is(err, fterrors.ErrJobCancelled) {
			if task.TaskDirection() == jobmanagertypes.TaskDirectionDownload {
				err = fs.DeleteFile(task.Destination())
				if err != nil {
					events.Events.Warn(strErrorDeletingCancelledTask, task.Destination(), err)
				}
			}
			finishTask(job, task)
			return
		}

		task.SetStatusAndError(jobmanagertypes.TaskStatusError, err)
		var filePath string
		if task.TaskDirection() == jobmanagertypes.TaskDirectionDownload {
			filePath = task.S3Object().Key
		} else {
			filePath = task.LocalFile().Path
		}

		events.Events.Error(
			"Failed to transfer file %s: %s",
			filePath,
			err.Error(),
		)

		if errors.Is(err, auth.ErrOIDCNotAuthenticated) {
			events.Events.Error(
				"OIDC session expired for profile %q — sign in again via the bucket browser to resume transfers",
				transferProfile.Name,
			)
		}

		if !job.HasTaskErrors() {
			job.SetHasTaskErrors(true)
		}
	} else {
		if !job.HasSuccessfulTasks() {
			job.SetHasSuccessfulTasks(true)
		}
		direction := "download"
		if task.TaskDirection() == jobmanagertypes.TaskDirectionDownload {
			s3Obj := task.S3Object()
			job.AddDatabaseObject(&databasetypes.DatabaseObject{
				Bucket:       transferProfile.Bucket,
				Key:          s3Obj.Key,
				Destination:  task.Destination(),
				Size:         s3Obj.Size,
				LastModified: time.Now(),
			})
			completeDownloadJobProgress(task, job)
		} else {
			direction = "upload"
			completeUploadJobProgress(task, job)
		}
		events.Events.Send(&eventtypes.TaskCompleteEvent{
			Id:          task.TaskId(),
			Direction:   direction,
			Destination: task.Destination(),
		})
		task.SetStatus(jobmanagertypes.TaskStatusCompleted)
	}
	finishTask(job, task)
}

//revive:enable:function-length

// TransferTask calls the transfer_api Upload and Download functions, which are responsible for the actual transferring of the task.
func TransferTask(task *jobmanagertypes.Task, job *jobmanagertypes.Job, s3Manager *transferapi.S3Manager) error {
	if job.CancelCtx.Err() != nil {
		return context.Cause(job.CancelCtx)
	}
	transferProfile := job.TransferProfile()

	//nolint:nestif
	if task.TaskDirection() == jobmanagertypes.TaskDirectionDownload {
		outputFile, err := core.CreateOutputFileAndDestDir(task.Destination())
		if err != nil {
			return err
		}
		writer := transferapi.FileWriter{
			File:  outputFile,
			Size:  task.S3Object().Size,
			Start: time.Now(),
		}
		cancelProgressChan := make(chan bool)
		go updateDownloadJobProgress(task, job, cancelProgressChan, &writer)
		_, err = s3Manager.Download(transferapi.DownloadConfig{
			AutoTune:    transferProfile.AutoTuning,
			ChunkSize:   int64(transferProfile.ChunkSize) * constants.MiB,
			Context:     job.CancelCtx,
			Key:         task.S3Object().Key,
			MemoryLimit: supportfile.GetMemoryInformation().TotalBytes,
			SourceSize:  task.S3Object().Size,
			Threads:     transferProfile.Threads,
			Writer:      &writer,
		})
		closeErr := writer.File.Close()
		if closeErr != nil {
			events.Events.Send(&eventtypes.AlertEvent{
				Msg:   fmt.Sprintf(strErrorClosingFile, writer.File.Name(), closeErr),
				Level: eventtypes.Warning,
			})
		}
		// Stop the sampling goroutine BEFORE rolling back: rollbackPausedTaskProgress
		// reads task.BytesTransferred, and a late progress sample landing between that
		// read and the reset would leave the job counter permanently skewed. This
		// ordering is intentional — do not move the rollback above this send.
		cancelProgressChan <- true
		if errors.Is(err, fterrors.ErrJobPaused) {
			rollbackPausedTaskProgress(&job.BytesDownloaded, task)
		}
		return err
	} else if task.TaskDirection() == jobmanagertypes.TaskDirectionUpload {
		file, err := os.Open(task.LocalFile().Path)
		if err != nil {
			return err
		}

		defer func(file *os.File) {
			err := file.Close()
			if err != nil {
				events.Events.Send(&eventtypes.AlertEvent{
					Msg:   fmt.Sprintf(strErrorClosingFile, file.Name(), err),
					Level: eventtypes.Warning,
				})
			}
		}(file)

		fileInfo, err := os.Stat(task.LocalFile().Path)
		if err != nil {
			return err
		}
		reader := transferapi.FileReader{
			File:  file,
			Size:  fileInfo.Size(),
			Start: time.Now(),
		}
		cancelProgressChan := make(chan bool)
		go updateUploadJobProgress(task, job, cancelProgressChan, &reader)
		_, err = s3Manager.Upload(transferapi.UploadConfig{
			AutoTune:          transferProfile.AutoTuning,
			Checksum:          task.Checksum(),
			ChecksumAlgorithm: string(transferProfile.Checksums.Algorithm),
			ChunkSize:         int64(transferProfile.ChunkSize) * constants.MiB,
			Context:           job.CancelCtx,
			FilePath:          task.LocalFile().Path,
			FileSize:          task.LocalFile().Size,
			Destination:       task.Destination(),
			MemoryLimit:       supportfile.GetMemoryInformation().TotalBytes,
			Reader:            &reader,
			StorageClass:      transferProfile.StorageClass,
			Threads:           transferProfile.Threads,
		})

		// Stop the sampling goroutine BEFORE rolling back: rollbackPausedTaskProgress
		// reads task.BytesTransferred, and a late progress sample landing between that
		// read and the reset would leave the job counter permanently skewed. This
		// ordering is intentional — do not move the rollback above this send.
		cancelProgressChan <- true
		if errors.Is(err, fterrors.ErrJobPaused) {
			rollbackPausedTaskProgress(&job.BytesUploaded, task)
		}
		return err
	}
	return errors.New("unknown transfer direction")
}

// rollbackPausedTaskProgress reverses a paused task's contribution to the job's
// running byte total. updateUploadJobProgress / updateDownloadJobProgress
// increment the job counter and task.BytesTransferred in lockstep, so
// task.BytesTransferred is exactly what this task added to the job total.
// Subtract that — NOT the transport's read/written count, which runs ahead of
// the last sampled progress (and can re-read multipart chunks). Subtracting the
// transport total over-counted the un-sampled tail on every pause, so the job's
// progress drifted downward across repeated pause/resume cycles even as more
// files completed. The task's counter is then reset so it re-counts cleanly
// when it restarts on resume.
func rollbackPausedTaskProgress(jobCounter *int64, task *jobmanagertypes.Task) {
	counted := atomic.LoadInt64(&task.BytesTransferred)
	atomic.AddInt64(jobCounter, -counted)
	atomic.StoreInt64(&task.BytesTransferred, 0)
}

func updateDownloadJobProgress(task *jobmanagertypes.Task, job *jobmanagertypes.Job, cancelChan chan bool,
	writer *transferapi.FileWriter) {
	var lastBytesWritten int64

	for {
		select {
		case <-cancelChan:
			return
		default:
			totalBytesWritten := writer.BytesWritten()
			newlyAddedBytes := totalBytesWritten - lastBytesWritten
			if newlyAddedBytes > 0 {
				atomic.AddInt64(&job.BytesDownloaded, newlyAddedBytes)
				atomic.AddInt64(&task.BytesTransferred, newlyAddedBytes)
				lastBytesWritten = totalBytesWritten
			}
			time.Sleep(constants.SleepDuration)
		}
	}
}

func updateUploadJobProgress(task *jobmanagertypes.Task, job *jobmanagertypes.Job, cancelChan chan bool, reader *transferapi.FileReader) {
	var lastBytesRead int64

	for {
		select {
		case <-cancelChan:
			return
		default:
			totalBytesRead := reader.BytesRead()
			newlyAddedBytes := totalBytesRead - lastBytesRead
			if newlyAddedBytes > 0 {
				atomic.AddInt64(&job.BytesUploaded, newlyAddedBytes)
				atomic.AddInt64(&task.BytesTransferred, newlyAddedBytes)
				lastBytesRead = totalBytesRead
			}
			time.Sleep(constants.SleepDuration)
		}
	}
}

// completeUploadJobProgress patches the task and job progress data when the upload task completes
func completeUploadJobProgress(task *jobmanagertypes.Task, job *jobmanagertypes.Job) {
	localFile := task.LocalFile()
	newlyAddedBytes := localFile.Size - task.BytesTransferred
	atomic.StoreInt64(&task.BytesTransferred, localFile.Size)
	atomic.AddInt64(&job.BytesUploaded, newlyAddedBytes)
	if job.TotalBytes < atomic.LoadInt64(&job.BytesUploaded) {
		atomic.StoreInt64(&job.BytesUploaded, job.TotalBytes)
	}
}

// completeDownloadJobProgress patches the task and job progress data when the download task completes
func completeDownloadJobProgress(task *jobmanagertypes.Task, job *jobmanagertypes.Job) {
	s3Obj := task.S3Object()
	newlyAddedBytes := s3Obj.Size - task.BytesTransferred
	atomic.StoreInt64(&task.BytesTransferred, s3Obj.Size)
	atomic.AddInt64(&job.BytesDownloaded, newlyAddedBytes)
	if job.TotalBytes < atomic.LoadInt64(&job.BytesDownloaded) {
		atomic.StoreInt64(&job.BytesDownloaded, job.TotalBytes)
	}
}
