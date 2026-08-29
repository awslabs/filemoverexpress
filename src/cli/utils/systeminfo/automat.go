package systeminfo

// autoMATFromLimits derives a default maxActiveTransfers (file-level upload
// concurrency) from the machine: scale with cores, but stay within the process
// open-file soft limit so we never exhaust file descriptors (which can otherwise
// silently drop files at very high concurrency). Pure and testable.
func autoMATFromLimits(cores int, fdSoft uint64) int {
	const (
		floor   = 16
		ceiling = 256
		// perCoreWorkers scales file-level concurrency with CPU count: cores*32 keeps a
		// 64-core box at the 256 ceiling while smaller boxes scale down proportionally.
		perCoreWorkers = 32
		// assumedThreads is a conservative stand-in for per-file multipart threads when
		// budgeting file descriptors. Kept >= the transfer-profile default
		// (constants.DefaultThreads = 10) so the fd budget stays safe even at the default;
		// revisit this if that per-file thread default is ever raised above 16.
		assumedThreads = 16
		fdSafetyPct    = 80
	)
	mat := cores * perCoreWorkers
	if mat > ceiling {
		mat = ceiling
	}
	if fdSoft > 0 {
		fdBudget := int(fdSoft) * fdSafetyPct / 100 / assumedThreads
		if fdBudget < mat {
			mat = fdBudget
		}
	}
	if mat < floor {
		mat = floor
	}
	return mat
}

// AutoMaxActiveTransfers resolves autoMATFromLimits against the live core count
// and open-file soft limit. Used as the maxActiveTransfers default when the user
// has not set an explicit value.
func AutoMaxActiveTransfers() int {
	return autoMATFromLimits(int(GetCoreCount()), getOpenFileSoftLimit())
}
