package auth_list

import (
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
	"github.com/awslabs/filemoverexpress/utils/safeconv"
)

const (
	MinCutoff        = 10
	MinBackoffFactor = 1.6
)

type (
	AuthAttemptListEntry struct {
		Count      int8
		Blocked    bool
		Timestamps []time.Time
	}

	// AuthAttemptList is responsible for keeping track of User IPs and the number of attempts they have made to authenticate in a certain
	// time range
	AuthAttemptList struct {
		Cutoff        int8
		BackoffFactor float64
		MaxTries      int8
		Entries       map[string]AuthAttemptListEntry
		mu            sync.Mutex
	}

	AuthAttemptListConfig struct {
		Cutoff        int8
		BackoffFactor float64
		MaxTries      int8
	}
)

// Add takes an IP/hostname and either creates a new entry, or updates the existing entry with the new login attempt
func (aal *AuthAttemptList) Add(remote string) {
	aal.mu.Lock()
	defer aal.mu.Unlock()

	if strings.Contains(remote, ":") {
		parts := strings.Split(remote, ":")
		if len(parts) > 0 {
			remote = parts[0]
		}
	}

	if entry, ok := aal.Entries[remote]; ok {
		aal.Entries[remote] = AuthAttemptListEntry{
			Count:      entry.Count + 1,
			Blocked:    false,
			Timestamps: append(entry.Timestamps, time.Now()),
		}
	} else {
		aal.Entries[remote] = AuthAttemptListEntry{
			Count:      1,
			Blocked:    false,
			Timestamps: []time.Time{time.Now()},
		}
	}
}

// Reset clears any recorded failed-attempt state for a remote, so a successful
// authentication wipes the slate — a legitimate client that mistyped its key once
// or twice does not carry those failures toward a future lockout.
func (aal *AuthAttemptList) Reset(remote string) {
	aal.mu.Lock()
	defer aal.mu.Unlock()

	if strings.Contains(remote, ":") {
		parts := strings.Split(remote, ":")
		if len(parts) > 0 {
			remote = parts[0]
		}
	}

	delete(aal.Entries, remote)
}

func (aal *AuthAttemptList) IsBlocked(remote string) error {
	aal.mu.Lock()
	defer aal.mu.Unlock()

	if strings.Contains(remote, ":") {
		parts := strings.Split(remote, ":")
		if len(parts) > 0 {
			remote = parts[0]
		}
	}

	aal.cleanup()
	aal.updateBlockedStatus(remote)

	// Only reject a client that has actually crossed the failure threshold and is
	// blocked. A sub-threshold failure entry must NOT reject the request here —
	// otherwise a single wrong attempt would lock out the correct key until the
	// entry ages out (~Cutoff minutes). The key is validated by the caller after
	// this returns nil.
	if entry, ok := aal.Entries[remote]; ok && entry.Blocked {
		return fmt.Errorf(strBlockedAuthAttempt, remote)
	}

	return nil
}

func (aal *AuthAttemptList) updateBlockedStatus(remote string) {
	if _, ok := aal.Entries[remote]; ok {
		entry := aal.Entries[remote]
		if entry.Blocked && entry.Count == 0 {
			aal.Entries[remote] = AuthAttemptListEntry{
				Count:      entry.Count,
				Timestamps: entry.Timestamps,
				Blocked:    false,
			}
			unblockedMessage := fmt.Sprintf(strUnblockedUser, remote)
			events.Events.Send(&eventtypes.AlertEvent{
				Msg:   unblockedMessage,
				Level: eventtypes.Info,
			})
		}
		if !entry.Blocked && entry.Count >= aal.MaxTries {
			aal.Entries[remote] = AuthAttemptListEntry{
				Count:      entry.Count,
				Timestamps: entry.Timestamps,
				Blocked:    true,
			}
			blockedMessage := fmt.Sprintf(strBlockedUser, remote, aal.Cutoff)
			events.Events.Send(&eventtypes.AlertEvent{
				Msg:   blockedMessage,
				Level: eventtypes.Warning,
			})
		}
	}
}

func (aal *AuthAttemptList) cleanup() {
	cutoff := time.Now().Add(time.Duration(aal.Cutoff) * time.Minute * -1)

	for key, entry := range aal.Entries {
		end := -1
		for idx, val := range entry.Timestamps {
			if val.Sub(cutoff) >= 0 {
				break
			}
			end = idx + 1
		}
		if end != -1 {
			blocked := aal.Entries[key].Blocked
			timestampCount := len(entry.Timestamps[end:])
			count, err := safeconv.IntToInt8(timestampCount)
			if err != nil {
				// Log warning and cap at MaxInt8 to prevent overflow
				events.Events.Send(&eventtypes.AlertEvent{
					Msg: fmt.Sprintf(
						"Warning: Timestamp count %d for %s exceeds int8 range, capping at %d",
						timestampCount,
						key,
						math.MaxInt8,
					),
					Level: eventtypes.Warning,
				})
				count = math.MaxInt8
			}
			aal.Entries[key] = AuthAttemptListEntry{
				Timestamps: entry.Timestamps[end:],
				Count:      count,
				Blocked:    blocked,
			}
		}

		if len(aal.Entries[key].Timestamps) == 0 {
			if !aal.Entries[key].Blocked {
				delete(aal.Entries, key)
			}
		}
	}
}

// NewAuthAttemptList takes a config containing a cutoff and backoff factor, and returns a new AuthAttemptList struct
func NewAuthAttemptList(config AuthAttemptListConfig) *AuthAttemptList {
	return &AuthAttemptList{
		Cutoff:        int8(math.Max(MinCutoff, float64(config.Cutoff))),
		BackoffFactor: math.Max(MinBackoffFactor, config.BackoffFactor),
		MaxTries:      config.MaxTries,
		Entries:       make(map[string]AuthAttemptListEntry),
	}
}
