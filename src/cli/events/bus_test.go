package events

import (
    "fmt"
    "sync"
    "testing"
    "time"

    "github.com/awslabs/filemoverexpress/types/eventtypes"
)

func TestEventBus_RegisterListener(t *testing.T) {
    c := make(chan eventtypes.Event, 1)
    err := Events.RegisterListener("test-listener-register", c, eventtypes.AllEvents)
    if err != nil {
        t.Errorf("TestEventBus_RegisterListener failed registering listener: %s", err)
    }
}

func TestEventBus_RegisterListenerDuplicate(t *testing.T) {
    l := "test-listener-duplicate"
    c := make(chan eventtypes.Event, 1)
    err := Events.RegisterListener(l, c, eventtypes.AllEvents)
    if err != nil {
        t.Errorf("TestEventBus_RegisterListenerDuplicate failed registering listener: %s", err)
    }

    c2 := make(chan eventtypes.Event, 1)
    err = Events.RegisterListener(l, c2, eventtypes.AllEvents)
    if err == nil {
        t.Error("TestEventBus_RegisterListenerDuplicate should have failed registering duplicate listener but succeeded")
    } else {
        expectedError := fmt.Sprintf("listener %s is already registered", l)
        if err.Error() != expectedError {
            t.Errorf("TestEventBus_RegisterListenerDuplicate failed, expected '%s', got '%s'", expectedError, err)
        }
    }
}

func TestEventBus_SendInfoMessage(t *testing.T) {
    c := make(chan eventtypes.Event, 1)
    err := Events.RegisterListener("test-listener-send-message", c, eventtypes.AllEvents)
    if err != nil {
        t.Errorf("TestEventBus_SendMessage failed registering listener: %s", err)
    }

    testString := "Hello world"
    Events.Info(testString)

    select {
    case evt := <-c:
        if evt.String() != testString {
            t.Errorf("TestEventBus_SendMessage failed, expected '%s', got '%s'", testString, evt.String())
        }
    case <-time.After(3 * time.Second):
        t.Errorf("TestEventBus_SendMessage failed, channel timed out before receiving message")
    }
}

func TestEventBus_SendMessageMultipleListeners(t *testing.T) {
    c := make(chan eventtypes.Event, 1)
    c2 := make(chan eventtypes.Event, 1)

    err := Events.RegisterListener("test-listener-send-message-1", c, eventtypes.AllEvents)
    if err != nil {
        t.Errorf("TestEventBus_SendMessage failed registering listener 1: %s", err)
    }
    err = Events.RegisterListener("test-listener-send-message-2", c2, eventtypes.AllEvents)
    if err != nil {
        t.Errorf("TestEventBus_SendMessage failed registering listener 2: %s", err)
    }

    testString := "hey world"
    Events.Info(testString)

    count := 0
    wg := &sync.WaitGroup{}
    wg.Add(2)
Loop:
    for count < 2 {
        select {
        case evt := <-c:
            if evt.String() == testString {
                count++
                wg.Done()
            }
        case evt := <-c2:
            if evt.String() == testString {
                count++
                wg.Done()
            }
        case <-time.After(3 * time.Second):
            t.Errorf("TestEventBus_SendMessage failed, channel timed out before receiving message")
            break Loop
        }
    }

    wg.Wait()
}

func TestEventBus_RemoveListener(t *testing.T) {
    id := "test-listener-remove-listener"
    c := make(chan eventtypes.Event, 1)
    err := Events.RegisterListener(id, c, eventtypes.AllEvents)
    if err != nil {
        t.Errorf("TestEventBus_RemoveListener failed registering listener: %s", err)
    }

    err = Events.RemoveListener(id)
    if err != nil {
        t.Errorf("TestEventBus_RemoveListener failed removing listener: %s", err)
    }
}

func TestEventBus_RemoveListenerInvalid(t *testing.T) {
    err := Events.RemoveListener("invalid-id")
    if err == nil {
        t.Error("TestEventBus_RemoveListenerInvalid failed, expected an error but got none")
    }
}

func TestEventBus_Shutdown(t *testing.T) {
    c := make(chan eventtypes.Event, 1)
    err := Events.RegisterListener("test-listener-shutdown", c, eventtypes.AllEvents)
    if err != nil {
        t.Errorf("TestEventBus_Shutdown failed registering listener: %s", err)
    }

    testString := "GRPC host is shutting down. Reason: User-initiated daemon mode shutdown."
    Events.Shutdown(eventtypes.DaemonModeExit)

    select {
    case evt := <-c:
        if evt.String() != testString {
            t.Errorf("TestEventBus_Shutdown failed, expected '%s', got '%s'", testString, evt.String())
        }
    case <-time.After(3 * time.Second):
        t.Errorf("TestEventBus_Shutdown failed, channel timed out before receiving message")
    }
}

func TestEventBus_Trace(t *testing.T) {
    c := make(chan eventtypes.Event, 1)
    err := Events.RegisterListener("test-listener-trace", c, eventtypes.AllEvents)
    if err != nil {
        t.Errorf("TestEventBus_Trace failed registering listener: %s", err)
    }

    testString := "hello world"
    Events.Trace(testString)

    select {
    case evt := <-c:
        if evt.String() != testString {
            t.Errorf("TestEventBus_Trace failed, expected '%s', got '%s'", testString, evt.String())
        }
    case <-time.After(3 * time.Second):
        t.Errorf("TestEventBus_Trace failed, channel timed out before receiving message")
    }
}

func TestEventBus_Debug(t *testing.T) {
    c := make(chan eventtypes.Event, 1)
    err := Events.RegisterListener("test-listener-debug", c, eventtypes.AllEvents)
    if err != nil {
        t.Errorf("TestEventBus_Debug failed registering listener: %s", err)
    }

    testString := "debuuuuugging"
    Events.Debug(testString)

    select {
    case evt := <-c:
        if evt.String() != testString {
            t.Errorf("TestEventBus_Debug failed, expected '%s', got '%s'", testString, evt.String())
        }
    case <-time.After(3 * time.Second):
        t.Errorf("TestEventBus_Debug failed, channel timed out before receiving message")
    }
}

func TestEventBus_Warn(t *testing.T) {
    c := make(chan eventtypes.Event, 1)
    err := Events.RegisterListener("test-listener-warn", c, eventtypes.AllEvents)
    if err != nil {
        t.Errorf("TestEventBus_Warn failed registering listener: %s", err)
    }

    testString := "warn msg"
    Events.Warn(testString)

    select {
    case evt := <-c:
        if evt.String() != testString {
            t.Errorf("TestEventBus_Warn failed, expected '%s', got '%s'", testString, evt.String())
        }
    case <-time.After(3 * time.Second):
        t.Errorf("TestEventBus_Warn failed, channel timed out before receiving message")
    }
}

func TestEventBus_Error(t *testing.T) {
    c := make(chan eventtypes.Event, 1)
    err := Events.RegisterListener("test-listener-err", c, eventtypes.AllEvents)
    if err != nil {
        t.Errorf("TestEventBus_Error failed registering listener: %s", err)
    }

    testString := "Error msg"
    Events.Error(testString)

    select {
    case evt := <-c:
        if evt.String() != testString {
            t.Errorf("TestEventBus_Error failed, expected '%s', got '%s'", testString, evt.String())
        }
    case <-time.After(3 * time.Second):
        t.Errorf("TestEventBus_Error failed, channel timed out before receiving message")
    }
}

func TestEventBus_Panic(t *testing.T) {
    c := make(chan eventtypes.Event, 1)
    err := Events.RegisterListener("test-listener-Panic", c, eventtypes.AllEvents)
    if err != nil {
        t.Errorf("TestEventBus_Panic failed registering listener: %s", err)
    }

    testString := "Panic msg"
    Events.Panic(testString)

    select {
    case evt := <-c:
        if evt.String() != testString {
            t.Errorf("TestEventBus_Panic failed, expected '%s', got '%s'", testString, evt.String())
        }
    case <-time.After(3 * time.Second):
        t.Errorf("TestEventBus_Panic failed, channel timed out before receiving message")
    }
}
