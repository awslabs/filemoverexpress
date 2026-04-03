package auth_list

//revive:disable:line-length-limit
const (
    strFailedAuthAttempt  = "failed authentication attempt from %s"
    strBlockedUser        = "blocked user with address %s after too many failed authentication attempts to the remote daemon. User will remain blocked for %d minutes"
    strUnblockedUser      = "user with address %s unblocked from remote daemon"
    strBlockedAuthAttempt = "blocked authentication attempt from %s"
)
