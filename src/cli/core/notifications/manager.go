package notifications

import (
	"context"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
)

const (
	listenerID     = "webhook-notifier"
	listenerBuffer = 64
)

var (
	instance *Manager
	once     sync.Once
)

type (
	// pending is what a running job was asked to notify about, captured at submit
	// time so the message can name the bucket/prefix without a later job lookup.
	pending struct {
		destination string
		bucket      string
		prefix      string
	}

	// Manager subscribes to job completion and error events and posts a webhook to
	// the destination registered for each job. One instance runs per daemon.
	Manager struct {
		store   *SecretStore
		mu      sync.Mutex
		pending map[string]pending
	}
)

// SecretDir is where encrypted webhook URLs live, under the FME config directory.
func SecretDir() string {
	return filepath.Join(config.GetConfigDir(), "notifications")
}

// Shared returns the process-wide Manager, constructing it on first use.
func Shared() *Manager {
	once.Do(func() {
		instance = &Manager{
			store:   NewSecretStore(SecretDir()),
			pending: map[string]pending{},
		}
	})
	return instance
}

// Start registers the job event listener. Called once when the daemon starts.
func (m *Manager) Start() {
	channel := make(chan eventtypes.Event, listenerBuffer)
	err := events.Events.RegisterListener(
		listenerID, channel,
		eventtypes.JobCompleteEventType, eventtypes.JobErrorEventType,
	)
	if err != nil {
		logger.Error("notifications: register listener: %v", err)
		return
	}
	go m.loop(channel)
}

func (m *Manager) loop(channel chan eventtypes.Event) {
	for evt := range channel {
		m.handle(evt)
	}
}

// RegisterJob records that a job should notify the named destination when it ends.
// bucket and prefix enrich the message. It is a no-op when destination is empty.
func (m *Manager) RegisterJob(jobID, destination, bucket, prefix string) {
	if destination == "" {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pending[jobID] = pending{destination: destination, bucket: bucket, prefix: prefix}
}

func (m *Manager) take(jobID string) (pending, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	p, ok := m.pending[jobID]
	if ok {
		delete(m.pending, jobID)
	}
	return p, ok
}

func (m *Manager) handle(evt eventtypes.Event) {
	switch e := evt.(type) {
	case *eventtypes.JobCompleteEvent:
		m.dispatch(e.Id, e.Name, completionOutcome(e), "")
	case *eventtypes.JobErrorEvent:
		detail := ""
		if e.Err != nil {
			detail = "Reason: " + e.Err.Error()
		}
		m.dispatch(e.Id, e.Name, OutcomeFailed, detail)
	}
}

func (m *Manager) dispatch(jobID, jobName string, outcome Outcome, detail string) {
	p, ok := m.take(jobID)
	if !ok {
		return
	}
	dest, found := findDestination(config.LoadConfiguration(), p.destination)
	if !found {
		logger.Warn("notifications: destination %q is no longer configured", p.destination)
		return
	}
	if !shouldSend(dest, outcome) {
		return
	}
	m.send(dest, Payload{
		JobName: jobName, Outcome: outcome, Bucket: p.bucket, Prefix: p.prefix,
		Host: hostname(), Detail: detail, FinishedAt: time.Now(),
	})
}

func (m *Manager) send(dest configtypes.NotificationDestination, p Payload) {
	url, err := m.store.Load(dest.Name)
	if err != nil {
		logger.Error("notifications: no stored url for %q: %v", dest.Name, err)
		return
	}
	body, err := encodeBody(dest.Preset, p)
	if err != nil {
		logger.Error("notifications: encode body for %q: %v", dest.Name, err)
		return
	}
	if err := postWebhook(context.Background(), url, body); err != nil {
		logger.Error("notifications: send to %q failed: %v", dest.Name, err)
		return
	}
	logger.Info("notifications: sent %q to destination %q", p.Outcome.label(), dest.Name)
}

// SendTest posts a test message to a destination's stored URL.
func (m *Manager) SendTest(dest configtypes.NotificationDestination) error {
	url, err := m.store.Load(dest.Name)
	if err != nil {
		return err
	}
	body, err := encodeBody(dest.Preset, Payload{
		JobName: "Test message", Outcome: OutcomeSuccess, Host: hostname(),
		Detail: "This is a test from File Mover Express.", FinishedAt: time.Now(),
	})
	if err != nil {
		return err
	}
	return postWebhook(context.Background(), url, body)
}

// HasURL reports whether a webhook URL is stored for the named destination.
func (m *Manager) HasURL(name string) bool {
	return m.store.Has(name)
}

func completionOutcome(e *eventtypes.JobCompleteEvent) Outcome {
	if e.HasTaskErrors {
		return OutcomePartial
	}
	return OutcomeSuccess
}

func findDestination(cfg configtypes.FmeConfig, name string) (configtypes.NotificationDestination, bool) {
	for _, d := range cfg.Notifications.Destinations {
		if d.Name == name {
			return d, true
		}
	}
	return configtypes.NotificationDestination{}, false
}

func shouldSend(dest configtypes.NotificationDestination, outcome Outcome) bool {
	if outcome == OutcomeFailed {
		return dest.NotifyOnFailure
	}
	return dest.NotifyOnFinish
}

func hostname() string {
	host, err := os.Hostname()
	if err != nil {
		return ""
	}
	return host
}
