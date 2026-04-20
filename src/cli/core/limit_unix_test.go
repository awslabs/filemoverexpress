package core

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRootCmd(t *testing.T) {
	err := CheckLimits()
	assert.Nil(t, err)
}
