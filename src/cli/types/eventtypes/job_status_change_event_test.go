package eventtypes

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

// The ASC MHL counts must survive serialization so a NEEDS_REVIEW pause can show
// real numbers in the pre-upload gate dialog before the job completes.
func TestJobStatusChangeEvent_ToProtobuf_CarriesASCMHL(t *testing.T) {
	evt := JobStatusChangeEvent{
		Id:              "job-1",
		Status:          "NEEDS_REVIEW",
		Timestamp:       time.Now(),
		ASCMHLVerified:  1,
		ASCMHLListed:    3,
		ASCMHLProblems:  2,
		ASCMHLAlgorithm: "xxhash64",
	}

	pbEvt, pbType := evt.ToProtobuf()

	assert.Equal(t, fmev1.EventType_EVENT_TYPE_JOB_STATUS_CHANGE_EVENT_TYPE, pbType)
	wrapper, ok := pbEvt.(*fmev1.ListEventsResponse_JobStatusChangeEvent)
	assert.True(t, ok)
	assert.Equal(t, "NEEDS_REVIEW", wrapper.JobStatusChangeEvent.GetStatus())
	assert.Equal(t, int32(1), wrapper.JobStatusChangeEvent.GetAscMhlVerified())
	assert.Equal(t, int32(3), wrapper.JobStatusChangeEvent.GetAscMhlListed())
	assert.Equal(t, int32(2), wrapper.JobStatusChangeEvent.GetAscMhlProblems())
	assert.Equal(t, "xxhash64", wrapper.JobStatusChangeEvent.GetAscMhlAlgorithm())
}
