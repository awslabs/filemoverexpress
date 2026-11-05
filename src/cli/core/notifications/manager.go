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
	// suppressed records an explicit per-transfer opt-out that overrides the
	// global "notify on every transfer" setting.
	pending struct {
		destination string
		bucket      string
		prefix      string
		suppressed  bool
	}

	// JobInfo is a non-sensitive completion summary a provider supplies to enrich
	// a notification (file counts, bytes, speed, and the resolved destination).
	JobInfo struct {
		FilesTransferred int
		FilesSkipped     int
		FilesErrored     int
		BytesTransferred int64
		BytesSkipped     int64
		BytesErrored     int64
		Duration         time.Duration
		Bucket           string
		Prefix           string
		IsUpload         bool
	}

	// Manager subscribes to job completion and error events and posts a webhook to
	// the destination registered for each job. One instance runs per daemon.
	Manager struct {
		store   *SecretStore
		mu      sync.Mutex
		pending map[string]pending
		jobInfo func(jobID string) (JobInfo, bool)
	}
)

// SetJobInfoProvider injects a function that returns a finished job's summary.
// It is wired at daemon start from the job manager, keeping this package free of
// a direct dependency on it.
func (m *Manager) SetJobInfoProvider(fn func(jobID string) (JobInfo, bool)) {
	m.jobInfo = fn
}

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

// SuppressJob records an explicit per-transfer opt-out, so this job is NOT
// notified even when the global "notify on every transfer" setting is on.
func (m *Manager) SuppressJob(jobID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pending[jobID] = pending{suppressed: true}
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
		// The raw job error can carry local filesystem paths and internal detail,
		// which must not be posted to a third-party webhook. Log the full error
		// locally and send only a sanitized, generic reason to the channel.
		if e.Err != nil {
			logger.Error("notifications: job %q (%s) failed: %v", e.Name, e.Id, e.Err)
		}
		m.dispatch(e.Id, e.Name, OutcomeFailed, sanitizedFailureDetail(e.Err))
	}
}

// sanitizedFailureDetail is the webhook-safe failure reason for a job error. The
// raw error may contain local filesystem paths or internal detail, so the
// third-party channel gets a generic reason (the full error is logged locally by
// the caller). Returns "" when there is no error.
func sanitizedFailureDetail(err error) string {
	if err == nil {
		return ""
	}
	return "Reason: the transfer reported an error (see the FME daemon log for details)"
}

func (m *Manager) dispatch(jobID, jobName string, outcome Outcome, detail string) {
	cfg := config.LoadConfiguration()
	p, hadPending := m.take(jobID)
	if hadPending && p.suppressed {
		return // explicit per-transfer opt-out
	}

	destName := p.destination
	bucket, prefix := p.bucket, p.prefix
	if destName == "" {
		// No explicit per-transfer destination. Apply the global default when it
		// is on - this is what covers hot-folder and CLI transfers, which never
		// register a destination of their own.
		if !cfg.Notifications.NotifyAllTransfers {
			return
		}
		destName = defaultDestinationName(cfg)
		if destName == "" {
			logger.Warn("notifications: notify-all is on but no default destination is set")
			return
		}
	}

	dest, found := findDestination(cfg, destName)
	if !found {
		logger.Warn("notifications: destination %q is no longer configured", destName)
		return
	}
	if !shouldSend(dest, outcome) {
		return
	}

	payload := Payload{
		JobName: jobName, Outcome: outcome, Bucket: bucket, Prefix: prefix,
		Host: hostname(), Detail: detail, FinishedAt: time.Now(), IsUpload: true,
	}
	if m.jobInfo != nil {
		if info, ok := m.jobInfo(jobID); ok {
			payload.HasStats = true
			payload.IsUpload = info.IsUpload
			payload.FilesTransferred = info.FilesTransferred
			payload.FilesSkipped = info.FilesSkipped
			payload.FilesErrored = info.FilesErrored
			payload.BytesTransferred = info.BytesTransferred
			payload.BytesSkipped = info.BytesSkipped
			payload.BytesErrored = info.BytesErrored
			payload.Duration = info.Duration
			if payload.Bucket == "" {
				payload.Bucket, payload.Prefix = info.Bucket, info.Prefix
			}
		}
	}
	m.send(dest, payload)
}

// defaultDestinationName resolves which destination the global "notify on every
// transfer" setting should use: the one flagged default, or the sole configured
// destination when none is explicitly flagged.
func defaultDestinationName(cfg configtypes.FmeConfig) string {
	dests := cfg.Notifications.Destinations
	for _, d := range dests {
		if d.IsDefault {
			return d.Name
		}
	}
	if len(dests) == 1 {
		return dests[0].Name
	}
	return ""
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
