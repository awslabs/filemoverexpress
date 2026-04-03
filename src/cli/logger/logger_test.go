package logger

import (
    "testing"

    "github.com/sirupsen/logrus"
    "github.com/sirupsen/logrus/hooks/test"
    "github.com/stretchr/testify/assert"
)

func TestSetConfiguration(t *testing.T) {
    err := Init(&Config{})
    assert.Error(t, err)

    err = Init(&Config{LogPath: "/tmp"})
    assert.Equal(t, err, nil)

    err = Init(&Config{Severity: logrus.InfoLevel})
    assert.Error(t, err)

    err = Init(&Config{LogPath: "/tmp", Severity: logrus.InfoLevel})
    assert.Equal(t, err, nil)
}

func TestLogOutput(t *testing.T) {
    _ = Init(&Config{LogPath: "/tmp/fme-logs", Severity: logrus.WarnLevel})
    fhook := test.NewLocal(flog)
    if fhook == nil {
        t.Fatal("Failed to initialize log hook")
        return
    }

    Error("Error")

    assert.Equal(t, logrus.ErrorLevel, fhook.LastEntry().Level)
    assert.Equal(t, "Error", fhook.LastEntry().Message)

    _ = Init(&Config{LogPath: "/tmp/fme-logs", Severity: logrus.ErrorLevel})
    Warn("Warning")

    assert.False(t, logrus.WarnLevel == fhook.LastEntry().Level)
    assert.False(t, fhook.LastEntry().Message == "Warning")
}

func TestTrace(t *testing.T) {
    _ = Init(&Config{LogPath: "/tmp/fme-logs", Severity: logrus.TraceLevel})
    fhook := test.NewLocal(flog)
    if fhook == nil {
        t.Fatal("Failed to initialize log hook")
        return
    }
    Trace("Trace")

    assert.Equal(t, logrus.TraceLevel, fhook.LastEntry().Level)
    assert.Equal(t, fhook.LastEntry().Message, "Trace")
}

func TestInfo(t *testing.T) {
    _ = Init(&Config{LogPath: "/tmp/fme-logs", Severity: logrus.InfoLevel})
    fhook := test.NewLocal(flog)
    if fhook == nil {
        t.Fatal("Failed to initialize log hook")
        return
    }
    Info("Info")

    assert.Equal(t, logrus.InfoLevel, fhook.LastEntry().Level)
    assert.Equal(t, fhook.LastEntry().Message, "Info")
}

func TestDebug(t *testing.T) {
    _ = Init(&Config{LogPath: "/tmp/fme-logs", Severity: logrus.DebugLevel})
    fhook := test.NewLocal(flog)
    if fhook == nil {
        t.Fatal("Failed to initialize log hook")
        return
    }
    Debug("Debug")

    assert.Equal(t, logrus.DebugLevel, fhook.LastEntry().Level)
    assert.Equal(t, fhook.LastEntry().Message, "Debug")
}
