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
		Id:        "job-1",
		Status:    "NEEDS_REVIEW",
		Timestamp: time.Now(),
		ASCMHL: &ASCMHLEventData{
			Verified:  1,
			Listed:    3,
			Problems:  2,
			Algorithm: "xxhash64",
			Failures:  []string{"clip.mov (hash mismatch)"},
		},
	}

	pbEvt, pbType := evt.ToProtobuf()

	assert.Equal(t, fmev1.EventType_EVENT_TYPE_JOB_STATUS_CHANGE_EVENT_TYPE, pbType)
	wrapper, ok := pbEvt.(*fmev1.ListEventsResponse_JobStatusChangeEvent)
	assert.True(t, ok)
	assert.Equal(t, "NEEDS_REVIEW", wrapper.JobStatusChangeEvent.GetStatus())
	asc := wrapper.JobStatusChangeEvent.GetAscMhl()
	assert.NotNil(t, asc)
	assert.Equal(t, int32(1), asc.GetVerified())
	assert.Equal(t, int32(3), asc.GetListed())
	assert.Equal(t, int32(2), asc.GetProblems())
	assert.Equal(t, "xxhash64", asc.GetAlgorithm())
	assert.Equal(t, []string{"clip.mov (hash mismatch)"}, asc.GetFailures())
}

// A status change for a job with no supplied manifest carries no ASC MHL payload.
func TestJobStatusChangeEvent_ToProtobuf_NoManifestIsNil(t *testing.T) {
	evt := JobStatusChangeEvent{Id: "job-1", Status: "IN_PROGRESS", Timestamp: time.Now()}

	pbEvt, _ := evt.ToProtobuf()

	wrapper, ok := pbEvt.(*fmev1.ListEventsResponse_JobStatusChangeEvent)
	assert.True(t, ok)
	assert.Nil(t, wrapper.JobStatusChangeEvent.GetAscMhl())
}
