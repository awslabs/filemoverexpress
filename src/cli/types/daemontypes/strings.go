package daemontypes

//revive:disable:line-length-limit
const (
	strReceivedShutdownSignal        = "Received a signal to shut down: %s\n"
	strFailedToRegisterEventListener = "failed to register event listener: %s"
	strFailedToStartFileWatcher      = "failed to start file watcher: %s\n"
	strInvalidBlockPath              = "invalid block path %s. Update your configuration file and restart"
	strErrorEvaluatingBlockedPath    = "error evaluating blocked path: %s"
	strBlockedPathIsSym              = "Blocked path %s is a symbolic link to %s. You may want to update your configuration file"
	strStoppingFileWatcher           = "stopping file watcher"
)
