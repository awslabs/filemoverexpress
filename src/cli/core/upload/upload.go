package upload

import (
	"path/filepath"

	"github.com/awslabs/filemoverexpress/core"
	"github.com/awslabs/filemoverexpress/core/job_manager"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/utils"
)

func Uploader(job *jobmanagertypes.Job) {
	transferProfile := job.TransferProfile()
	jobManager := job_manager.GetInstance()
	_, sessErr := jobManager.GetS3Manager(transferProfile)
	if sessErr != nil {
		events.Events.Error(strFailedEstablishingAwsSession)
		return
	}
	basePath := job.UploadBasePath()
	if basePath != "" && !filepath.IsAbs(basePath) {
		events.Events.Error(strBasePathNotAbsolute, basePath)
		return
	}

	job.SetDestination(utils.CleanPrefix("/", job.Destination()))

	err := core.CheckLimits()
	if err != nil {
		events.Events.Warn(strFailedIncreasingMaxOpenFiles, err)
		return
	}

	err = jobManager.AddJob(job)
	if err != nil {
		events.Events.Error(strErrorCreatingJob, err)
		return
	}
	var absoluteFilePathSources []string
	for _, source := range job.Sources() {
		if !filepath.IsAbs(source) {
			absoluteFilePathSources = append(absoluteFilePathSources, filepath.Join(basePath, source))
		} else {
			absoluteFilePathSources = append(absoluteFilePathSources, source)
		}
	}
	job.SetSources(absoluteFilePathSources)

	jobManager.UploadJob(job)
}
