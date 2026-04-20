package daemontypes

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetInstance(t *testing.T) {
	//verify GetInstance instantiates the instance the first time its called
	assert.Nil(t, instance)
	nrd := GetInstance()
	assert.NotNil(t, instance)
	assert.IsType(t, FMEDaemon{}, nrd)
	assert.IsType(t, &FMEDaemon{}, instance)

	//verify GetInstance returns the contents of instance when it is changed
	daemon := FMEDaemon{
		Signals:            nil,
		watcher:            nil,
		watchedFiles:       nil,
		maxActiveTransfers: 42424242,
		work:               nil,
		eventChannel:       nil,
	}
	instance = &daemon
	assert.Equal(t, daemon, GetInstance())
	instance.maxActiveTransfers = 123123
	assert.Equal(t, int32(123123), GetInstance().maxActiveTransfers)
}
