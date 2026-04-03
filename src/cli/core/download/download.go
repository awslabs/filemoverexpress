package download

import (
    "github.com/awslabs/filemoverexpress/core"
    "github.com/awslabs/filemoverexpress/core/job_manager"
    "github.com/awslabs/filemoverexpress/events"
    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

// Downloader is the main entry point for the S3 downloader functionality
func Downloader(job *jobmanagertypes.Job) {
    transferProfile := job.TransferProfile()
    jobManager := job_manager.GetInstance()
    _, sessErr := jobManager.GetS3Manager(transferProfile.Profile, transferProfile.Bucket, transferProfile.Region, transferProfile.Endpoint)
    if sessErr != nil {
        events.Events.Error(strFailedEstablishingAwsSession, sessErr)
        return
    }

    err := jobManager.AddJob(job)
    if err != nil {
        events.Events.Error(strErrorCreatingJob, err)
        return
    }

    if err = core.CreateDirIfDoesNotExists(job.Destination()); err != nil {
        events.Events.Error(
            "Failed to create destination directory: %s",
            err.Error(),
        )
        job.SetStatus(jobmanagertypes.JobStatusError)
        err = jobManager.DeleteJob(job.JobId())
        if err != nil {
            events.Events.Warn(strErrorDeletingJob, err)
        }
        return
    }

    jobManager.DownloadJob(job)
}
