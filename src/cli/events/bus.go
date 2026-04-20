package events

import (
	"fmt"
	"slices"
	"sync"
	"time"

	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
)

//goland:noinspection ALL
var Events = EventBus{
	listeners: map[string]EventListener{},
	lock:      sync.RWMutex{},
}

type (
	EventListener struct {
		channel chan eventtypes.Event
		filters []eventtypes.MessageFlags
	}
	EventBus struct {
		listeners map[string]EventListener
		lock      sync.RWMutex
	}
	SendQueueEvent struct {
		Id                  string
		Source              string
		Destination         string
		Bucket              string
		Prefix              string
		TransferProfileName string
		Size                int64
	}
)

func (eb *EventBus) RegisterListener(id string, listener chan eventtypes.Event, filters ...eventtypes.MessageFlags) error {
	eb.lock.Lock()
	defer eb.lock.Unlock()

	if _, ok := eb.listeners[id]; ok {
		return fmt.Errorf(strListenerAlreadyRegistered, id)
	}

	eb.listeners[id] = EventListener{
		listener,
		filters,
	}

	return nil
}

func (eb *EventBus) RemoveListener(id string) error {
	if _, ok := eb.listeners[id]; ok {
		return nil
	}

	return fmt.Errorf(strListenerNotRegistered, id)
}

func (eb *EventBus) Trace(message string, args ...interface{}) {
	if len(message) == 0 {
		logger.Error(strTriedSendingEmptyMessages)
		return
	}

	evt := &eventtypes.MessageEvent{Msg: logger.FormatLogMessage(message, args), EventPriority: logger.TraceLevel}
	eb.Send(evt)
}

func (eb *EventBus) Debug(message string, args ...interface{}) {
	if len(message) == 0 {
		logger.Error(strTriedSendingEmptyMessages)
		return
	}

	evt := &eventtypes.MessageEvent{Msg: logger.FormatLogMessage(message, args), EventPriority: logger.DebugLevel}
	eb.Send(evt)
}

func (eb *EventBus) Info(message string, args ...interface{}) {
	if len(message) == 0 {
		logger.Error(strTriedSendingEmptyMessages)
		return
	}

	evt := &eventtypes.MessageEvent{Msg: logger.FormatLogMessage(message, args), EventPriority: logger.InfoLevel}
	eb.Send(evt)
}

func (eb *EventBus) Warn(message string, args ...interface{}) {
	if len(message) == 0 {
		logger.Error(strTriedSendingEmptyMessages)
		return
	}

	evt := &eventtypes.MessageEvent{Msg: logger.FormatLogMessage(message, args), EventPriority: logger.WarnLevel}
	eb.Send(evt)
}

func (eb *EventBus) Error(message string, args ...interface{}) {
	if len(message) == 0 {
		logger.Error(strTriedSendingEmptyMessages)
		return
	}

	evt := &eventtypes.MessageEvent{Msg: logger.FormatLogMessage(message, args), EventPriority: logger.ErrorLevel}
	eb.Send(evt)
}

func (eb *EventBus) Fatal(message string, args ...interface{}) {
	if len(message) == 0 {
		logger.Error(strTriedSendingEmptyMessages)
		return
	}

	evt := &eventtypes.MessageEvent{Msg: logger.FormatLogMessage(message, args), EventPriority: logger.FatalLevel}
	eb.Send(evt)
}

func (eb *EventBus) Panic(message string, args ...interface{}) {
	if len(message) == 0 {
		logger.Error(strTriedSendingEmptyMessages)
		return
	}

	evt := &eventtypes.MessageEvent{Msg: logger.FormatLogMessage(message, args), EventPriority: logger.PanicLevel}
	eb.Send(evt)
}

//revive:disable:cognitive-complexity,cyclomatic
func (eb *EventBus) Send(event eventtypes.Event) {
	eb.lock.RLock()
	defer eb.lock.RUnlock()

	if len(eb.listeners) == 0 || event.Priority() == logger.FatalLevel {
		logger.SendLog(event.Priority(), event.String())
	} else {
		for _, listener := range eb.listeners {
			if !slices.Contains(listener.filters, eventtypes.AllEvents) && !slices.Contains(listener.filters, event.Type()) {
				continue
			}

			go eb.doSend(listener, event)
		}
	}
}

func (*EventBus) Shutdown(discoType eventtypes.DisconnectType) {
	discoEvt := eventtypes.ServerDisconnectEvent{
		DisconnectType: discoType,
	}

	Events.Send(&discoEvt)
}

//revive:enable:cognitive-complexity,cyclomatic

func (eb *EventBus) Close() {
	for _, listener := range eb.listeners {
		close(listener.channel)
	}
}

func (*EventBus) doSend(listener EventListener, event eventtypes.Event) {
	listener.channel <- event
}

func (eb *EventBus) SendJobStatusChange(jobId string, status string, timestamp time.Time) {
	evt := eventtypes.JobStatusChangeEvent{
		Id:        jobId,
		Status:    status,
		Timestamp: timestamp,
	}
	eb.Send(&evt)
}
