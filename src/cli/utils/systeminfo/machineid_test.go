package systeminfo

import (
    "testing"

    "github.com/stretchr/testify/assert"
)

func TestGetMachineID(t *testing.T) {
    id := GetMachineID()
    assert.NotEmpty(t, id)
}
