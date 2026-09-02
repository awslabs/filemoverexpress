package transferstats

import (
	"fmt"
	"sync"
	"time"

	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/transfertypes"
)

const (
	transferStatsEventInterval  = time.Second * 5
	eventBusId                  = "transferstatsservice"
	strFailedToRegisterListener = "failed to register event listener for transferstats, no transferstats will be available: %w"
	progressChannelSize         = 100
	eventsChannelSize           = 10
)

var (
	ProgressChannel       = make(chan eventtypes.JobProgressEvent, progressChannelSize)
	lock                  = sync.RWMutex{}
	eventsChannel         = make(chan eventtypes.Event, eventsChannelSize)
	jobs                  = make(map[string]*jobData)
	pausedJobs            = make(map[string]*jobData)
	activeDownloads       = 0
	activeUploads         = 0
	bpsUpload             int64
	bpsDownload           int64
	activeBytesDownloaded int64
	activeBytesUploaded   int64
	totalBytesDownloaded  int64
	totalBytesUploaded    int64
	startDownloads        *time.Time
	startUploads          *time.Time
	initialized           = false

	jobEvents = []eventtypes.MessageFlags{
		eventtypes.JobCreateEventType,
		eventtypes.JobCompleteEventType,
		eventtypes.JobErrorEventType,
		eventtypes.JobStatusChangeEventType,
	}
)

type (
	jobData struct {
		lastBytes int64
		totalSize int64
		direction transfertypes.Direction
	}
)

func Initialize() {
	if initialized {
		return
	}

	err := events.Events.RegisterListener(eventBusId, eventsChannel, jobEvents...)
	if err != nil {
		logger.Fatal(fmt.Errorf(strFailedToRegisterListener, err).Error())
	}
	go eventHandler()
	go func() {
		for {
			sendEvent()
			time.Sleep(transferStatsEventInterval)
		}
	}()

	initialized = true
}

func sendEvent() {
	lock.RLock()
	defer lock.RUnlock()
	evt := eventtypes.TransferStatsEvent{
		ActiveDownloads:      activeDownloads,
		ActiveUploads:        activeUploads,
		DownloadBps:          bpsDownload,
		UploadBps:            bpsUpload,
		TotalBytesDownloaded: totalBytesDownloaded,
		TotalBytesUploaded:   totalBytesUploaded,
	}

	events.Events.Send(&evt)
}

// region Event handlers

func eventHandler() {
	for {
		select {
		case progressEvt := <-ProgressChannel:
			handleProgress(&progressEvt)
		case rawEvt := <-eventsChannel:
			dispatchEvent(rawEvt)
		}
	}
}

// dispatchEvent routes a bus event to the right handler. Each branch uses a
// checked type assertion and rejects a nil concrete pointer: the bus can deliver
// a typed-but-nil event (its Type() returns a constant without dereferencing), and
// the previous unchecked `rawEvt.(*T).Id` then nil-dereferenced and crashed the
// daemon. A nil or unexpected event is now dropped instead of panicking.
func dispatchEvent(rawEvt eventtypes.Event) {
	if rawEvt == nil {
		return
	}
	switch rawEvt.Type() {
	case eventtypes.JobCreateEventType:
		if evt, ok := rawEvt.(*eventtypes.JobCreateEvent); ok && evt != nil {
			handleCreate(evt)
		}
	case eventtypes.JobStatusChangeEventType:
		if evt, ok := rawEvt.(*eventtypes.JobStatusChangeEvent); ok && evt != nil {
			handleStatusChange(evt)
		}
	case eventtypes.JobCompleteEventType:
		if evt, ok := rawEvt.(*eventtypes.JobCompleteEvent); ok && evt != nil {
			handleCompletion(evt.Id)
		}
	case eventtypes.JobErrorEventType:
		if evt, ok := rawEvt.(*eventtypes.JobErrorEvent); ok && evt != nil {
			handleCompletion(evt.Id)
		}
	default:
		logger.Debug("Received an unexpected event type: %d", rawEvt.Type())
	}
}

func handleCreate(evt *eventtypes.JobCreateEvent) {
	lock.Lock()
	defer lock.Unlock()
	jobs[evt.Id] = &jobData{
		lastBytes: 0,
		direction: evt.Direction,
		totalSize: 0,
	}
}

func handleStatusChange(evt *eventtypes.JobStatusChangeEvent) {
	lock.Lock()
	defer lock.Unlock()

	if !jobmanagertypes.JobStatusInProgress.Is(evt.Status) {
		if jobmanagertypes.JobStatusPaused.Is(evt.Status) {
			handlePause(evt.Id)
		}

		return
	}

	if lb, found := pausedJobs[evt.Id]; found {
		jobs[evt.Id] = lb
		delete(pausedJobs, evt.Id)
	}

	lb, found := jobs[evt.Id]
	if !found {
		lb, found = pausedJobs[evt.Id]
		if !found {
			logger.Debug("Failed locating job for updates")
			return
		}

		jobs[evt.Id] = lb
	}

	n := time.Now()
	switch lb.direction {
	case transfertypes.Upload:
		activeUploads++
		if activeUploads == 1 {
			startUploads = &n
		}
	case transfertypes.Download:
		activeDownloads++
		if activeDownloads == 1 {
			startDownloads = &n
		}
	}
}

func handleProgress(evt *eventtypes.JobProgressEvent) {
	lock.Lock()
	defer lock.Unlock()

	lb, found := jobs[evt.Id]
	if !found {
		logger.Debug("TransferStats event handler couldn't find job %s", evt.Id)
		return
	}

	if lb.totalSize == 0 {
		lb.totalSize = evt.TotalBytes
	}

	newBytes := evt.BytesTransferred
	delta := newBytes - lb.lastBytes
	lb.lastBytes += delta

	if lb.direction == transfertypes.Upload && startUploads != nil {
		totalBytesUploaded += delta
		activeBytesUploaded += delta

		duration := int64(time.Since(*startUploads).Seconds())
		if duration < 1 {
			bpsUpload = 0
		} else {
			bpsUpload = activeBytesUploaded / duration
		}
	} else if lb.direction == transfertypes.Download && startDownloads != nil {
		totalBytesDownloaded += delta
		activeBytesDownloaded += delta
		duration := int64(time.Since(*startDownloads).Seconds())
		if duration < 1 {
			bpsDownload = 0
		} else {
			bpsDownload = activeBytesDownloaded / duration
		}
	}
}

func handlePause(jobId string) {
	lb, found := jobs[jobId]
	if !found {
		logger.Debug("[TransferStats.handlePause] Couldn't find job %s", jobId)
		return
	}

	pausedJobs[jobId] = lb

	switch lb.direction {
	case transfertypes.Upload:
		if activeUploads > 0 {
			activeUploads--
		}

		if activeUploads == 0 {
			startUploads = nil
			bpsUpload = 0
			activeBytesUploaded = 0
		}
	case transfertypes.Download:
		if activeDownloads > 0 {
			activeDownloads--
		}

		if activeDownloads == 0 {
			startDownloads = nil
			bpsDownload = 0
			activeBytesDownloaded = 0
		}
	}

	if startDownloads == nil && startUploads == nil {
		clear(jobs)
	} else {
		delete(jobs, jobId)
	}
}

func handleCompletion(jobId string) {
	lock.Lock()
	defer lock.Unlock()

	lb, found := jobs[jobId]
	if !found {
		logger.Debug("TransferStats event handler couldn't find job %s", jobId)
		return
	}

	delta := lb.totalSize - lb.lastBytes
	switch lb.direction {
	case transfertypes.Upload:
		totalBytesUploaded += delta
		activeBytesUploaded += delta

		if activeUploads > 0 {
			activeUploads--
		}

		if activeUploads == 0 {
			startUploads = nil
			bpsUpload = 0
			activeBytesUploaded = 0
		}
	case transfertypes.Download:
		totalBytesDownloaded += delta
		activeBytesDownloaded += delta

		if activeDownloads > 0 {
			activeDownloads--
		}

		if activeDownloads == 0 {
			startDownloads = nil
			bpsDownload = 0
			activeBytesDownloaded = 0
		}
	}

	if startDownloads == nil && startUploads == nil {
		clear(jobs)
	}
}

// endregion

// region Receiver methods

func UploadBps() int64 {
	lock.RLock()
	defer lock.RUnlock()

	if startUploads == nil {
		return 0
	}

	duration := int64(time.Since(*startUploads).Seconds())
	if duration == 0 {
		return 0
	}

	return activeBytesUploaded / duration
}

func DownloadBps() int64 {
	lock.RLock()
	defer lock.RUnlock()

	if startDownloads == nil {
		return 0
	}

	duration := int64(time.Since(*startDownloads).Seconds())
	if duration == 0 {
		return 0
	}

	return activeBytesDownloaded / duration
}

// endregion
