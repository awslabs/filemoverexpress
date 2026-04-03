package jobmanagertypes

import (
    "strconv"
    "sync"
    "sync/atomic"
    "time"

    "google.golang.org/protobuf/types/known/timestamppb"

    "github.com/awslabs/filemoverexpress/logger"
    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
    "github.com/awslabs/filemoverexpress/utils"
    "github.com/awslabs/filemoverexpress/utils/safeconv"
)

const (
    TaskStatusPreFlight    TaskStatus = "PRE-FLIGHT"
    TaskStatusQueued       TaskStatus = "QUEUED"
    TaskStatusInProgress   TaskStatus = "IN_PROGRESS"
    TaskStatusCompleted    TaskStatus = "COMPLETED"
    TaskStatusChecksumming TaskStatus = "CHECKSUMMING"
    TaskStatusCancelled    TaskStatus = "CANCELLED"
    TaskStatusPaused       TaskStatus = "PAUSED"
    TaskStatusSkipped      TaskStatus = "SKIPPED"
    TaskStatusError        TaskStatus = "ERROR"

    TaskDirectionUpload   TaskDirection = "UPLOAD"
    TaskDirectionDownload TaskDirection = "DOWNLOAD"
)

type (
    TaskStatus    string
    TaskDirection string

    LocalFile struct {
        LastModified time.Time
        Path         string
        Size         int64
    }

    S3Object struct {
        Key          string
        LastModified time.Time
        Size         int64
    }

    Task struct {
        destination      string
        taskId           string
        localFile        LocalFile
        s3Object         S3Object
        taskDirection    TaskDirection
        status           TaskStatus
        statusMessage    string
        jobId            string
        checksum         string
        lock             *sync.RWMutex
        priority         int
        err              error
        BytesTransferred int64
    }

    TaskConfig struct {
        Destination   string
        LocalFile     LocalFile
        S3Object      S3Object
        JobId         string
        TaskDirection TaskDirection
        Priority      int
    }
)

func NewTask(config TaskConfig) (*Task, error) {
    taskId, err := utils.CalculateTransferId(config.S3Object.Key, config.LocalFile.Path, strconv.Itoa(time.Now().Nanosecond()))
    if err != nil {
        return nil, err
    }
    return &Task{
        taskId:        taskId,
        localFile:     config.LocalFile,
        s3Object:      config.S3Object,
        status:        TaskStatusPreFlight,
        jobId:         config.JobId,
        taskDirection: config.TaskDirection,
        priority:      config.Priority,
        destination:   config.Destination,
        lock:          &sync.RWMutex{},
    }, nil
}

// region Getters and Setters

func (t *Task) GetSourcePath() string {
    if t.TaskDirection() == TaskDirectionDownload {
        return t.S3Object().Key
    }
    return t.LocalFile().Path
}

func (t *Task) GetSize() int64 {
    if t.TaskDirection() == TaskDirectionDownload {
        return t.S3Object().Size
    }
    return t.LocalFile().Size
}

func (t *Task) TaskId() string {
    t.lock.RLock()
    defer t.lock.RUnlock()
    return t.taskId
}

func (t *Task) SetTaskId(taskId string) {
    t.lock.Lock()
    defer t.lock.Unlock()
    t.taskId = taskId
}

func (t *Task) Destination() string {
    t.lock.RLock()
    defer t.lock.RUnlock()
    return t.destination
}

func (t *Task) SetDestination(destination string) {
    t.lock.Lock()
    defer t.lock.Unlock()
    t.taskId = destination
}

func (t *Task) TaskDirection() TaskDirection {
    t.lock.RLock()
    defer t.lock.RUnlock()
    return t.taskDirection
}

func (t *Task) SetTaskDirection(taskDirection TaskDirection) {
    t.lock.Lock()
    defer t.lock.Unlock()
    t.taskDirection = taskDirection
}

func (t *Task) JobId() string {
    t.lock.RLock()
    defer t.lock.RUnlock()
    return t.jobId
}

func (t *Task) SetJobId(jobId string) {
    t.lock.Lock()
    defer t.lock.Unlock()
    t.jobId = jobId
}

func (t *Task) S3Object() S3Object {
    t.lock.RLock()
    defer t.lock.RUnlock()
    return t.s3Object
}

func (t *Task) SetS3Object(s3Object S3Object) {
    t.lock.Lock()
    defer t.lock.Unlock()
    t.s3Object = s3Object
}

func (t *Task) Status() TaskStatus {
    t.lock.RLock()
    defer t.lock.RUnlock()
    return t.status
}

func (t *Task) SetStatus(status TaskStatus) {
    t.lock.Lock()
    defer t.lock.Unlock()
    t.status = status
}

func (t *Task) SetStatusAndError(status TaskStatus, err error) {
    t.lock.Lock()
    defer t.lock.Unlock()
    t.status = status
    t.err = err
}

func (t *Task) Err() error {
    t.lock.RLock()
    defer t.lock.RUnlock()
    return t.err
}

func (t *Task) SetErr(err error) {
    t.lock.Lock()
    defer t.lock.Unlock()
    t.err = err
}

func (t *Task) StatusMessage() string {
    t.lock.RLock()
    defer t.lock.RUnlock()
    return t.statusMessage
}

func (t *Task) SetStatusMessage(statusMessage string) {
    t.lock.Lock()
    defer t.lock.Unlock()
    t.statusMessage = statusMessage
}

func (t *Task) LocalFile() LocalFile {
    t.lock.RLock()
    defer t.lock.RUnlock()
    return t.localFile
}

func (t *Task) SetLocalFile(localFile LocalFile) {
    t.lock.Lock()
    defer t.lock.Unlock()
    t.localFile = localFile
}

func (t *Task) Priority() int {
    t.lock.RLock()
    defer t.lock.RUnlock()
    if t.status == TaskStatusPaused {
        return t.priority * -1
    }
    return t.priority
}

func (t *Task) SetPriority(priority int) {
    t.lock.Lock()
    defer t.lock.Unlock()
    t.priority = priority
}

func (t *Task) Checksum() string {
    t.lock.Lock()
    defer t.lock.Unlock()
    return t.checksum
}

func (t *Task) SetChecksum(checksum string) {
    t.lock.Lock()
    defer t.lock.Unlock()
    t.checksum = checksum
}

func (t *Task) ToProtobuf() *fmev1.Task {
    t.lock.RLock()
    defer t.lock.RUnlock()

    var errorString string
    if t.err != nil {
        errorString = t.err.Error()
    }

    // Safe conversion for priority - Issue #8
    priority, err := safeconv.IntToInt32(t.priority)
    if err != nil {
        logger.Error("Invalid Priority value %d for task %s: %v, using default", t.priority, t.taskId, err)
        priority = 0 // Default priority
    }

    lf := fmev1.TaskLocalFile{
        Path:         t.localFile.Path,
        Size:         t.localFile.Size,
        LastModified: timestamppb.New(t.localFile.LastModified),
    }

    s3o := fmev1.TaskS3Object{
        Key:          t.s3Object.Key,
        Size:         t.s3Object.Size,
        LastModified: timestamppb.New(t.s3Object.LastModified),
    }

    return &fmev1.Task{
        TaskId:           t.taskId,
        Destination:      t.destination,
        LocalFile:        &lf,
        S3Object:         &s3o,
        TaskDirection:    string(t.taskDirection),
        Status:           string(t.status),
        StatusMessage:    t.statusMessage,
        JobId:            t.jobId,
        Checksum:         t.checksum,
        Priority:         priority,
        Err:              errorString,
        BytesTransferred: atomic.LoadInt64(&t.BytesTransferred),
    }
}

//endregion
