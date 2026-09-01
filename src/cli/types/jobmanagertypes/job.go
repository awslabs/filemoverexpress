package jobmanagertypes

import (
	"context"
	"strconv"
	"sync"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/databasetypes"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/types/transfertypes"
	"github.com/awslabs/filemoverexpress/utils"
)

type (
	Job struct {
		jobId                 string
		name                  string
		transferProfile       *configtypes.TransferProfile
		status                JobStatus
		statusMessage         string
		lock                  *sync.RWMutex
		WaitGroup             sync.WaitGroup
		direction             transfertypes.Direction
		TotalBytes            int64
		BytesUploaded         int64
		BytesDownloaded       int64
		CancelCtx             context.Context
		CancelFunc            context.CancelCauseFunc
		hasTaskErrors         bool
		hasSuccessfulTasks    bool
		dbObjects             []*databasetypes.DatabaseObject
		destination           string
		TimestampCreated      time.Time
		TimestampDiscovering  time.Time
		TimestampChecksumming time.Time
		TimestampTransferring time.Time
		TimestampCompleted    time.Time
		sources               []string
		s3PrefixToTrim        string
		force                 bool
		uploadBasePath        string
	}
	JobConfig struct {
		Direction       transfertypes.Direction
		Name            string
		TransferProfile *configtypes.TransferProfile
		Destination     string
		Sources         []string
		S3PrefixToTrim  string
		Force           bool
		UploadBasePath  string
	}
)

func NewJob(config JobConfig) (*Job, error) {
	jobId, err := utils.CalculateTransferId(config.Name, config.TransferProfile.String(), strconv.Itoa(time.Now().Nanosecond()))
	if err != nil {
		return nil, err
	}
	ctx, cancelFunc := context.WithCancelCause(context.Background())

	return &Job{
		BytesDownloaded:       0,
		BytesUploaded:         0,
		CancelCtx:             ctx,
		CancelFunc:            cancelFunc,
		direction:             config.Direction,
		hasTaskErrors:         false,
		hasSuccessfulTasks:    false,
		jobId:                 jobId,
		lock:                  &sync.RWMutex{},
		name:                  config.Name,
		TotalBytes:            0,
		transferProfile:       config.TransferProfile,
		WaitGroup:             sync.WaitGroup{},
		status:                JobStatusCreated,
		TimestampCreated:      time.Now(),
		TimestampDiscovering:  time.Time{},
		TimestampChecksumming: time.Time{},
		TimestampTransferring: time.Time{},
		TimestampCompleted:    time.Time{},
		sources:               config.Sources,
		s3PrefixToTrim:        config.S3PrefixToTrim,
		force:                 config.Force,
		uploadBasePath:        config.UploadBasePath,
		destination:           config.Destination,
	}, nil
}

// region Getters and Setters

func (j *Job) JobId() string {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.jobId
}

func (j *Job) SetJobId(jobId string) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.jobId = jobId
}

func (j *Job) Name() string {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.name
}

func (j *Job) SetName(name string) {
	j.lock.Lock()
	defer j.lock.Unlock()
	oldName := j.name
	j.name = name

	events.Events.Send(&eventtypes.JobUpdateEvent{
		Id:      j.jobId,
		Name:    name,
		OldName: oldName,
	})
}

func (j *Job) TransferProfile() configtypes.TransferProfile {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return *j.transferProfile
}

func (j *Job) SetTransferProfile(transferProfile *configtypes.TransferProfile) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.transferProfile = transferProfile
}

func (j *Job) Status() JobStatus {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.status
}

func (j *Job) SetStatus(status JobStatus) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.status = status
	n := time.Now()

	switch status {
	case JobStatusCreated:
		j.TimestampCreated = n

	case JobStatusChecksumming:
		j.TimestampChecksumming = n

	case JobStatusDiscovering:
		j.TimestampDiscovering = n

	case JobStatusInProgress:
		j.TimestampTransferring = n

	case JobStatusCompleted:
		j.TimestampCompleted = n
	}

	go events.Events.SendJobStatusChange(j.jobId, string(j.status), n)
}

func (j *Job) StatusMessage() string {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.statusMessage
}

func (j *Job) SetStatusMessage(statusMessage string) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.statusMessage = statusMessage
}

func (j *Job) HasTaskErrors() bool {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.hasTaskErrors
}

func (j *Job) SetHasTaskErrors(hasTaskErrors bool) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.hasTaskErrors = hasTaskErrors
}

func (j *Job) HasSuccessfulTasks() bool {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.hasSuccessfulTasks
}

func (j *Job) SetHasSuccessfulTasks(hasSuccessfulTasks bool) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.hasSuccessfulTasks = hasSuccessfulTasks
}

func (j *Job) Direction() transfertypes.Direction {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.direction
}

func (j *Job) SetDirection(direction transfertypes.Direction) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.direction = direction
}

func (j *Job) DatabaseObjects() []*databasetypes.DatabaseObject {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.dbObjects
}

func (j *Job) AddDatabaseObject(dbObj *databasetypes.DatabaseObject) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.dbObjects = append(j.dbObjects, dbObj)
}

func (j *Job) Destination() string {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.destination
}

func (j *Job) SetDestination(destination string) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.destination = destination
}

func (j *Job) GetTimestampCreated() time.Time {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.TimestampCreated
}

func (j *Job) SetTimestampCreated(t time.Time) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.TimestampCreated = t
}

func (j *Job) GetTimestampDiscovering() time.Time {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.TimestampDiscovering
}

func (j *Job) SetTimestampDiscovering(t time.Time) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.TimestampDiscovering = t
}

func (j *Job) GetTimestampChecksumming() time.Time {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.TimestampChecksumming
}

func (j *Job) SetTimestampChecksumming(t time.Time) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.TimestampChecksumming = t
}

func (j *Job) GetTimestampTransferring() time.Time {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.TimestampTransferring
}

func (j *Job) SetTimestampTransferring(t time.Time) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.TimestampTransferring = t
}

func (j *Job) GetTimestampCompleted() time.Time {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.TimestampCompleted
}

func (j *Job) SetTimestampCompleted(t time.Time) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.TimestampCompleted = t
}

func (j *Job) Sources() []string {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.sources
}

func (j *Job) SetSources(sources []string) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.sources = sources
}

func (j *Job) S3PrefixToTrim() string {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.s3PrefixToTrim
}

func (j *Job) SetS3PrefixToTrim(s3PrefixToTrim string) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.s3PrefixToTrim = s3PrefixToTrim
}

func (j *Job) Force() bool {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.force
}

func (j *Job) SetForce(force bool) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.force = force
}

func (j *Job) UploadBasePath() string {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.uploadBasePath
}

func (j *Job) SetUploadBasePath(uploadBasePath string) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.uploadBasePath = uploadBasePath
}

// endregion

func (j *Job) ToProtobuf() *fmev1.Job {
	j.lock.RLock()
	defer j.lock.RUnlock()

	return &fmev1.Job{
		JobId:               j.jobId,
		Name:                j.name,
		TransferProfileName: j.transferProfile.Name,
		Status:              string(j.status),
		StatusMessage:       j.statusMessage,
		Direction:           string(j.direction),
		TotalBytes:          j.TotalBytes,
		BytesUploaded:       j.BytesUploaded,
		BytesDownloaded:     j.BytesDownloaded,
		HasTaskErrors:       j.hasTaskErrors,
		HasSuccessfulTasks:  j.hasSuccessfulTasks,
		Destination:         j.destination,
		Created:             timestamppb.New(j.TimestampCreated),
		Discovering:         timestamppb.New(j.TimestampDiscovering),
		Checksumming:        timestamppb.New(j.TimestampChecksumming),
		Transferring:        timestamppb.New(j.TimestampTransferring),
		Completed:           timestamppb.New(j.TimestampCompleted),
		Bucket:              j.transferProfile.Bucket,
		Force:               j.force,
	}
}
