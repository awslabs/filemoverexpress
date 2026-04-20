package clitools

import (
	"fmt"
	"time"

	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/utils"
)

var (
	lastMessage  string
	lastPriority logger.LogLevel
	jobNames     = make(map[string]string)
)

type Transfer struct {
	Id                  string
	Status              string
	TransferProfileName string
	Bucket              string
	Destination         string
	Prefix              string
	Source              string
	TotalBytes          int64
	BytesTransferred    int64
	Queued              time.Time
	Started             time.Time
	Completed           time.Time
	Message             string
	Error               error
}

//revive:disable:cyclomatic This function needs to be written this way, disabling this linter
func ProcessEvents(eventChannel chan eventtypes.Event) {
	for rawEvt := range eventChannel {
		switch rawEvt.Type() {
		case eventtypes.JobCreateEventType:
			handleJobCreateEvent(rawEvt.(*eventtypes.JobCreateEvent))
		case eventtypes.JobStatusChangeEventType:
			handleJobStatusChangeEvent(rawEvt.(*eventtypes.JobStatusChangeEvent))
		case eventtypes.JobProgressEventType:
			handleJobProgressEvent(rawEvt.(*eventtypes.JobProgressEvent))
		case eventtypes.JobCompleteEventType:
			handleJobCompleteEvent(rawEvt.(*eventtypes.JobCompleteEvent))
		case eventtypes.JobErrorEventType:
			handleJobErrorEvent(rawEvt.(*eventtypes.JobErrorEvent))
		case eventtypes.TaskCompleteEventType:
			handleTaskCompleteEvent(rawEvt.(*eventtypes.TaskCompleteEvent))
		case eventtypes.JobChecksumProgressEventType:
			handleChecksumProgressEvent(rawEvt.(*eventtypes.JobChecksumProgressEvent))
		default:
			handleMessage(rawEvt)
		}
	}
}

//revive:enable:cyclomatic

func RegisterEventListener(id string) {
	eventsChannel := make(chan eventtypes.Event)
	err := events.Events.RegisterListener(id, eventsChannel, eventtypes.AllEvents)
	if err != nil {
		events.Events.Fatal(strFailedRegisteringEventListener, err.Error())
	}
	go ProcessEvents(eventsChannel)
}

func handleMessage(evt eventtypes.Event) {
	send(evt.Priority(), evt.String())
}

func handleJobCompleteEvent(evt *eventtypes.JobCompleteEvent) {
	send(evt.Priority(), fmt.Sprintf(strJobCompleted, evt.Name))
}

func handleJobErrorEvent(evt *eventtypes.JobErrorEvent) {
	send(evt.Priority(), fmt.Sprintf(strJobError, evt.Name, evt.Err.Error()))
}

func handleJobCreateEvent(evt *eventtypes.JobCreateEvent) {
	jobNames[evt.Id] = evt.Name

	send(evt.Priority(), fmt.Sprintf(strJobCreated, string(evt.Direction), evt.Name))
}

func handleJobProgressEvent(evt *eventtypes.JobProgressEvent) {
	send(
		evt.Priority(),
		fmt.Sprintf(strJobProgress, evt.Name, utils.FormatBytes(evt.BytesTransferred), utils.FormatBytes(evt.TotalBytes)),
	)
}

func handleJobStatusChangeEvent(evt *eventtypes.JobStatusChangeEvent) {
	if jobName, found := jobNames[evt.Id]; found {
		send(
			evt.Priority(),
			fmt.Sprintf(strJobStatusChange, jobName, jobmanagertypes.JobStatusFromString(evt.Status)),
		)
	}
}

func handleTaskCompleteEvent(evt *eventtypes.TaskCompleteEvent) {
	send(evt.Priority(), evt.String())
}

func handleChecksumProgressEvent(evt *eventtypes.JobChecksumProgressEvent) {
	if jobName, found := jobNames[evt.JobId]; found {
		var msg string
		if evt.Total == 0 {
			msg = "Valid checksums discovered for all files, skipping checksumming"
		} else {
			pct := float64(evt.Completed) / float64(evt.Total) * 100

			msg = fmt.Sprintf(
				"Checksum progress for '%s': %.2f%%%% (%d of %d)",
				jobName,
				pct,
				evt.Completed,
				evt.Total,
			)
		}

		send(evt.Priority(), msg)
	}
}

// endregion

func send(priority logger.LogLevel, message string) {
	if priority != lastPriority || message != lastMessage {
		logger.SendLog(priority, message)
		lastPriority = priority
		lastMessage = message
	}
}
