package databasetypes

//revive:disable:line-length-limit
const (
	strUnableToObtainDbLock      = "unable to obtain database lock. Another instance of %s might be running"
	strFailedToCloseDbConnection = "failed to close local database connection %s"
	strFailedUpdatingDb          = "error occurred while updating local database: %s"
	strFailedInitializingDb      = "failed to initialize the database: %s"
	strFailedToUpdateDb          = "failed to update the database"
)
