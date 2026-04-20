package globals

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFmeGlobalsWorks(t *testing.T) {
	instance1 := GetInstance()
	assert.Empty(t, instance1.GetVersion())
	assert.False(t, instance1.GetDaemonMode())

	instance1.SetDaemonMode(true)
	instance1.SetVersion("1.2.3")

	instance2 := GetInstance()
	assert.True(t, instance2.GetDaemonMode())
	assert.Equal(t, "1.2.3", instance2.GetVersion())
}
