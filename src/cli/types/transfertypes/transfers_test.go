package transfer

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// Make sure to reset the data inbetween tests, as it's a shared struct, and incrementing in one test, will cause
// the following test to have unexpected values
func beforeEach() {
	ActiveTransfers.Uploads = 0
	ActiveTransfers.Downloads = 0
}

func TestTransfers_Add(t *testing.T) {
	beforeEach()

	expected := int32(1)
	ActiveTransfers.Inc(Upload)
	assert.Equal(t, expected, ActiveTransfers.UploadsCount())
}

func TestTransfers_Remove(t *testing.T) {
	beforeEach()

	expected := int32(0)
	ActiveTransfers.Inc(Upload)
	ActiveTransfers.Dec(Upload)
	assert.Equal(t, expected, ActiveTransfers.UploadsCount())
}

func TestTransfers_UploadsCount(t *testing.T) {
	beforeEach()

	expected := int32(1)
	ActiveTransfers.Inc(Upload)
	assert.Equal(t, expected, ActiveTransfers.UploadsCount())
}

func TestTransfers_DownloadsCount(t *testing.T) {
	beforeEach()

	expected := int32(1)
	ActiveTransfers.Inc(Download)
	assert.Equal(t, expected, ActiveTransfers.DownloadsCount())
}
