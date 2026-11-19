package jobmanagertypes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/transfertypes"
)

func newASCMHLTestJob(t *testing.T) *Job {
	t.Helper()
	job, err := NewJob(JobConfig{
		Name:      "asc-mhl-job",
		Direction: transfertypes.Upload,
		TransferProfile: &configtypes.TransferProfile{
			Name:         "test-profile",
			Bucket:       "test-bucket",
			Region:       "us-west-2",
			Profile:      "test-profile",
			StorageClass: "standard",
		},
	})
	require.NoError(t, err)
	return job
}

// A job with no supplied manifest reports zero ASC MHL verification, and the
// protobuf carries the zero values.
func TestJob_ASCMHLResultDefaultsEmpty(t *testing.T) {
	job := newASCMHLTestJob(t)

	assert.Equal(t, 0, job.ASCMHLVerified())
	assert.Equal(t, 0, job.ASCMHLListed())
	assert.Equal(t, 0, job.ASCMHLProblems())
	assert.Equal(t, "", job.ASCMHLAlgorithm())

	pb := job.ToProtobuf()
	assert.Equal(t, int32(0), pb.GetAscMhlVerified())
	assert.Equal(t, int32(0), pb.GetAscMhlListed())
	assert.Equal(t, int32(0), pb.GetAscMhlProblems())
	assert.Equal(t, "", pb.GetAscMhlAlgorithm())
}

// SetASCMHLResult records the verification outcome, readable through the getters
// and carried onto the protobuf the GUI consumes.
func TestJob_SetASCMHLResult(t *testing.T) {
	job := newASCMHLTestJob(t)

	job.SetASCMHLResult(3, 4, 1, "xxhash64")

	assert.Equal(t, 3, job.ASCMHLVerified())
	assert.Equal(t, 4, job.ASCMHLListed())
	assert.Equal(t, 1, job.ASCMHLProblems())
	assert.Equal(t, "xxhash64", job.ASCMHLAlgorithm())

	pb := job.ToProtobuf()
	assert.Equal(t, int32(3), pb.GetAscMhlVerified())
	assert.Equal(t, int32(4), pb.GetAscMhlListed())
	assert.Equal(t, int32(1), pb.GetAscMhlProblems())
	assert.Equal(t, "xxhash64", pb.GetAscMhlAlgorithm())
}
