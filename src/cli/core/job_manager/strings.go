package job_manager

const (
    strFailedEstablishingAwsSession = "failed to establish a session to AWS: %s"
    strTaskWithUnknownJob           = "task references job with Id %s, which does not exist"
    strDeleteNonExistentJob         = "unable to delete job with Id %s since it does not exist"
    strTaskAlreadyExists            = "task %s with task Id %s already exists"
    strJobAlreadyExists             = "job with jobId %s already exists"
    strErrorDiscoveringObject       = "error discovering object: %s"
    strErrorDeletingCancelledTask   = "Error deleting file %s which was cancelled mid-transfer: %s"
    strErrorStoringDbObjects        = "Error storing database objects: %s"
    strErrorCreatingDb              = "Error creating database: %s"
    strErrorClosingFile             = "Failed closing file %s: %s\n"
    strJobCancelledDuringChecksum   = "Job %s cancelled now that checksums are complete"
)
