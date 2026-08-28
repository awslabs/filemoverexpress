package auth_list

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testRemote = "1.2.3.4"

func newTestList(maxTries int8) *AuthAttemptList {
	return NewAuthAttemptList(AuthAttemptListConfig{
		Cutoff:        MinCutoff,
		BackoffFactor: MinBackoffFactor,
		MaxTries:      maxTries,
	})
}

// A single (or any sub-threshold) failed attempt must NOT block the client. This is the
// regression guard for the lockout bug: previously one wrong pre-shared key rejected every
// subsequent request — including one with the correct key — until the entry aged out.
func TestIsBlocked_SubThresholdFailuresDoNotBlock(t *testing.T) {
	list := newTestList(3)

	list.Add(testRemote)
	require.NoError(t, list.IsBlocked(testRemote), "one failed attempt should not block")

	list.Add(testRemote)
	require.NoError(t, list.IsBlocked(testRemote), "attempts below MaxTries should not block")
}

// Once the client crosses MaxTries within the cutoff window it is blocked.
func TestIsBlocked_BlocksAtMaxTries(t *testing.T) {
	list := newTestList(3)

	for i := 0; i < 3; i++ {
		list.Add(testRemote)
	}

	assert.Error(t, list.IsBlocked(testRemote), "reaching MaxTries should block the client")
}

// A successful authentication (Reset) clears recorded failures so they don't count toward a
// future lockout, and a fresh attempt is not blocked.
func TestReset_ClearsFailures(t *testing.T) {
	list := newTestList(3)

	list.Add(testRemote)
	list.Add(testRemote)
	list.Reset(testRemote)

	assert.Empty(t, list.Entries, "reset should remove the client's failure entry")
	assert.NoError(t, list.IsBlocked(testRemote), "a reset client should not be blocked")
}

// The remote's port is stripped consistently across Add / IsBlocked / Reset so entries key
// on the address only.
func TestPortStrippedConsistently(t *testing.T) {
	list := newTestList(3)

	list.Add(testRemote + ":50106")
	_, ok := list.Entries[testRemote]
	assert.True(t, ok, "entry should be keyed on the address without the port")

	list.Reset(testRemote + ":40000")
	assert.Empty(t, list.Entries, "reset with a different port should still clear the entry")
}
