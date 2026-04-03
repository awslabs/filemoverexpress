package transfer

import (
    "testing"

    "github.com/stretchr/testify/assert"
)

func TestNewTransferInfo(t *testing.T) {
    expected := Info{
        Completed:   false,
        Direction:   Upload,
        Destination: "s3://FROM_PREFIX/foo/bar/file",
        Source:      "/foo/bar/file",
    }

    u := NewTransferInfo(
        Upload,
        "s3://FROM_PREFIX/foo/bar/file",
        "/foo/bar/file",
    )

    assert.Equal(t, expected, u)
}
