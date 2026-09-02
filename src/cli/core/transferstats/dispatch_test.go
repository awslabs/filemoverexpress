package transferstats

import (
	"testing"

	"github.com/awslabs/filemoverexpress/types/eventtypes"
)

// TestDispatchEvent_TypedNilDoesNotPanic reproduces the historical transferstats
// crash: the bus can deliver a typed-but-nil event (its Type() returns a constant
// without dereferencing), and the old unchecked `rawEvt.(*T).Id` then
// nil-dereferenced and panicked the daemon. dispatchEvent must drop such events.
func TestDispatchEvent_TypedNilDoesNotPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("dispatchEvent panicked on a nil/typed-nil event: %v", r)
		}
	}()

	var nilComplete *eventtypes.JobCompleteEvent
	dispatchEvent(nilComplete)

	var nilErr *eventtypes.JobErrorEvent
	dispatchEvent(nilErr)

	var nilCreate *eventtypes.JobCreateEvent
	dispatchEvent(nilCreate)

	var nilStatus *eventtypes.JobStatusChangeEvent
	dispatchEvent(nilStatus)

	dispatchEvent(nil)
}
