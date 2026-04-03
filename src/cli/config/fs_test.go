package config

import (
    "os"
    "testing"

    "github.com/stretchr/testify/assert"
)

func TestMakeConfigDir(t *testing.T) {
    info := makeConfigDir("/tmp/makeconfigdirtest")
    assert.Equal(t, info.Name(), "makeconfigdirtest")
    err := os.RemoveAll("/tmp/makeconfigdirtest")
    if err != nil {
        t.Error("TestMakeConfigDir: failed to delete test config directory")
    }
}
