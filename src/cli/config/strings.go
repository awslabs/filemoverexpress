package config

//revive:disable:line-length-limit
const (
	strFailedCreatingDir    = "Failed to create configuration directory: %s"
	strFailedReadingDir     = "Failed to read configuration directory after creation: %s\n"
	strPathExistsAndNotDir  = "%s already exists and isn't a directory\n"
	strFailedWritingFile    = "Failed to write configuration file: %s"
	strFailedGettingHomeDir = "Failed to get user home directory: %s\n"
	strInvalidFilterExpr    = "Invalid filter expression: %s\n"
	strInvalidMaxAgeWarning = "Invalid configuration value for max age, \"%s\", using default value of \"0\" instead\n"
	strInvalidFieldValue    = "invalid value for field '%s': was %v, now %v"
	strUnableToLoadConfig   = "unable to load configuration file: %s"
	strErrorUpdatingConfig  = "Error updating configuration file: %s"
)
