package service

//revive:disable:line-length-limit
const (
	strApiServerDisabled  = "API Server disabled. GUI connections to this daemon won't work unless the API server is turned on in the configuration file. Turn on the API server by setting \"api_server.enabled\" to true"
	strRemoteDaemonStart  = "Daemon is listening on %s on port(s) %s"
	strCertOrKeyMissing   = "TLS is enabled, but certificate or key file unset"
	strCertFileOpenFailed = "unable to open TLS certificate file: %s"
	strKeyFileOpenFailed  = "unable to open TLS key file: %s"
	strPSKEnvVarNotSet    = "%s environment variable not set, required to enable PreSharedKey"
	strPSKDecryptFailed   = "failed to decrypt API server key: %s"

	// API Server strings
	strUploadMissingTransferProfiles = "upload file request missing or invalid transfer profile"
	strUnableToWriteConfig           = "unable to write configuration file"
	strSuccessFullyUpdatedConfig     = "Successfully updated configuration file"
	strDestinationMayNotBeEmpty      = "destination might not be empty"
	strFailedToFindTransferProfile   = "failed to find transfer profile"
	strFailedGeneratingInventory     = "failed to generate inventory report: %s"
	strConfigurationDisabled         = "remote configuration editing is turned off"
	strUploadMissingSources          = "no sources provided for upload"
	strFailedToCreateJob             = "failed to create job"
	strFailedEstablishingAwsSession  = "failed to establish a session to AWS: %s"
	strFailedToListObjects           = "unable to list s3 content for %s"
	strJobDoesNotExist               = "job with Id %s does not exist"
	strUnableToCancelJob             = "unable to cancel job with Id %s"
	strUnableToPauseJob              = "unable to pause job with Id %s because status is %s"
	strUnableToResubmitJob           = "unable to resubmit job with Id %s because status is %s"
	strUnableToResumeJob             = "unable to resume job with Id %s"
	strGrpcSendFailed                = "failed sending message: %s"
	strLocalDeleteNotAllowed         = "Local file delete actions are not allowed by configuration permissions"
	strRemoteDeleteNotAllowed        = "Remote file delete actions are not allowed by configuration permissions"
	strLocalRenameNotAllowed         = "Local file rename actions are not allowed by configuration permissions"
	strRemoteRenameNotAllowed        = "Remote file rename actions are not allowed by configuration permissions"
)
