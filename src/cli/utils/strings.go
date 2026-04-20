package utils

//revive:disable:line-length-limit
const (
	strSleepPreventionUnsuccessful = "The application wasn't able to prevent your computer from going to sleep"
	strInvalidTimeFormat           = "invalid format for the time range"
	strErrorGeneratingSha256       = "error occurred generating SHA256: %s"
	strFailedGettingHomeDir        = "failed to get user home directory: %s"
	strFailedCreatingLogDir        = "failed to create log directory: %s"
	strFailedOpenCrashLog          = "failed to open crash log file: %s"
	strFailedCloseCrashLog         = "failed to close crash log file: %s"
	strUnrecoverableError          = "an unrecoverable error occurred"
	strUnrecoverableErrorLogged    = "an unrecoverable error occurred and has been logged to %s. Download this file and provide it to AWS Support"
)
