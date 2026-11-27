package notifications

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

// completionOutcome must agree with the job's terminal status so that a job the
// daemon marks ERROR fires NotifyOnFailure destinations instead of being sent as
// a partial success. Regression test for issue #202: an all-failed unattended
// hot-folder batch must be visible to failure-only webhooks.
func TestCompletionOutcome(t *testing.T) {
	tests := []struct {
		name string
		evt  *eventtypes.JobCompleteEvent
		want Outcome
	}{
		{
			name: "all failed (ERROR status) is a failure",
			evt:  &eventtypes.JobCompleteEvent{Status: string(jobmanagertypes.JobStatusError), HasTaskErrors: true},
			want: OutcomeFailed,
		},
		{
			name: "some failed, some succeeded is partial",
			evt:  &eventtypes.JobCompleteEvent{Status: string(jobmanagertypes.JobStatusCompletedWithWarnings), HasTaskErrors: true, HasSuccessfulTasks: true},
			want: OutcomePartial,
		},
		{
			name: "clean completion is success",
			evt:  &eventtypes.JobCompleteEvent{Status: string(jobmanagertypes.JobStatusCompleted), HasSuccessfulTasks: true},
			want: OutcomeSuccess,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, completionOutcome(tt.evt))
		})
	}
}

// A destination set to notify only on failure must receive the ERROR job, and a
// finish-only destination must not.
func TestShouldSend_FailureRouting(t *testing.T) {
	failedEvt := &eventtypes.JobCompleteEvent{Status: string(jobmanagertypes.JobStatusError), HasTaskErrors: true}
	outcome := completionOutcome(failedEvt)

	failureOnly := configtypes.NotificationDestination{NotifyOnFinish: false, NotifyOnFailure: true}
	finishOnly := configtypes.NotificationDestination{NotifyOnFinish: true, NotifyOnFailure: false}

	assert.True(t, shouldSend(failureOnly, outcome), "failure-only destination should fire on an ERROR job")
	assert.False(t, shouldSend(finishOnly, outcome), "finish-only destination should not fire on an ERROR job")
}
