package job_manager

import (
	"fmt"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/constants"
	checksumMgr "github.com/awslabs/filemoverexpress/core/checksums/checksum-manager"
	"github.com/awslabs/filemoverexpress/core/discovery/local_discovery"
	"github.com/awslabs/filemoverexpress/core/discovery/s3_discovery"
	"github.com/awslabs/filemoverexpress/core/filters"
	blockedPaths "github.com/awslabs/filemoverexpress/core/filters/blocked-paths"
	fileAlreadyExists "github.com/awslabs/filemoverexpress/core/filters/file-already-exists"
	"github.com/awslabs/filemoverexpress/core/filters/inclusion"
	maxAge "github.com/awslabs/filemoverexpress/core/filters/max-age"
	"github.com/awslabs/filemoverexpress/core/filters/metadata"
	objectAlreadyExists "github.com/awslabs/filemoverexpress/core/filters/object-already-exists"
	"github.com/awslabs/filemoverexpress/core/sorting"
	fileExtSorting "github.com/awslabs/filemoverexpress/core/sorting/file-ext-sorting"
	transferApi "github.com/awslabs/filemoverexpress/core/transfer-api"
	"github.com/awslabs/filemoverexpress/core/transferstats"
	"github.com/awslabs/filemoverexpress/events"
	fmeErrors "github.com/awslabs/filemoverexpress/fme-errors"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/databasetypes"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/types/transfertypes"
)

var (
	instance        *JobManager
	clearableStates = []jobmanagertypes.JobStatus{
		jobmanagertypes.JobStatusCompleted,
		jobmanagertypes.JobStatusError,
		jobmanagertypes.JobStatusCancelled,
	}
)

type (
	JobManager struct {
		Tasks          map[string]map[string]*jobmanagertypes.Task
		Jobs           map[string]*jobmanagertypes.Job
		s3ManagerCache map[string]*transferApi.S3Manager
		tasksLock      *sync.Mutex
		jobsLock       *sync.Mutex
		s3ManagerLock  *sync.RWMutex
		priorityQueue  *PriorityQueue
	}
)

// GetS3Manager either returns the cached s3 manager, or it creates a new S3 manager, caches it and returns it.
func (jm *JobManager) GetS3Manager(tp configtypes.TransferProfile) (*transferApi.S3Manager, error) {
	key := strings.Join([]string{tp.Profile, tp.Bucket, tp.Region, tp.Endpoint}, "-")

	jm.s3ManagerLock.RLock()
	s3m, exists := jm.s3ManagerCache[key]
	jm.s3ManagerLock.RUnlock()
	if exists {
		return s3m, nil
	}
	s3m, err := transferApi.NewS3Manager(tp)
	if err != nil {
		return nil, err
	}
	jm.s3ManagerLock.Lock()
	jm.s3ManagerCache[key] = s3m
	jm.s3ManagerLock.Unlock()

	return s3m, nil
}

// GetInstance makes the JobManager a singleton struct. Only one job manager exists in the daemon.
func GetInstance() *JobManager {
	if instance == nil {
		instance = &JobManager{
			Tasks:          make(map[string]map[string]*jobmanagertypes.Task),
			Jobs:           make(map[string]*jobmanagertypes.Job),
			s3ManagerCache: make(map[string]*transferApi.S3Manager),
			tasksLock:      &sync.Mutex{},
			jobsLock:       &sync.Mutex{},
			s3ManagerLock:  &sync.RWMutex{},
			priorityQueue:  NewPriorityQueue(),
		}
		maxActiveTransfers := config.LoadConfiguration().General.MaxActiveTransfers
		maxActiveTransfers = max(maxActiveTransfers, 1)

		for i := 0; i < int(maxActiveTransfers); i++ {
			go instance.createTransferWorker()
		}
	}
	return instance
}

// getNextTask pops the highest priority task from priorityQueue. Returns nil if the queue is empty.
func (jm *JobManager) getNextTask() *jobmanagertypes.Task {
	task := jm.priorityQueue.Pop()
	if task != nil {
		status := task.Status()
		switch status {
		case jobmanagertypes.TaskStatusSkipped:
		case jobmanagertypes.TaskStatusCancelled:
			task = jm.priorityQueue.Pop()
		case jobmanagertypes.TaskStatusPaused:
			jm.priorityQueue.Push(task)
			task = jm.priorityQueue.Pop()
			time.Sleep(5 * time.Millisecond)
		default:
			return task
		}
	}

	return task
}

func (jm *JobManager) GetTasks(jobId string) map[string]*jobmanagertypes.Task {
	jm.tasksLock.Lock()
	defer jm.tasksLock.Unlock()
	return jm.Tasks[jobId]
}

// AddTasksForTransfer updates the Tasks map and pushes tasks onto priorityQueue
func (jm *JobManager) AddTasksForTransfer(tasks []*jobmanagertypes.Task, job *jobmanagertypes.Job) (errors []error) {
	jm.tasksLock.Lock()
	defer jm.tasksLock.Unlock()
	jobId := job.JobId()
	taskCount := 0
	priority := len(tasks)
	var validTasks []*jobmanagertypes.Task

	for _, task := range tasks {
		taskId := task.TaskId()
		if _, exists := jm.Tasks[jobId]; !exists {
			jm.Tasks[jobId] = make(map[string]*jobmanagertypes.Task)
		}
		if _, exists := jm.Tasks[jobId][taskId]; exists {
			err := fmt.Errorf(strTaskAlreadyExists, task.GetSourcePath(), taskId)
			task.SetStatus(jobmanagertypes.TaskStatusError)
			errors = append(errors, err)
			continue
		}
		jm.Tasks[jobId][taskId] = task
		validTasks = append(validTasks, task)
		task.SetPriority(priority)
		priority--
		taskCount++
	}
	job.WaitGroup.Add(taskCount)
	jm.priorityQueue.PushBulk(validTasks)
	return errors
}

// AddJob adds a job object to the Jobs map.
func (jm *JobManager) AddJob(job *jobmanagertypes.Job) error {
	jm.jobsLock.Lock()
	defer jm.jobsLock.Unlock()

	jobId := job.JobId()
	if _, alreadyExists := jm.Jobs[jobId]; alreadyExists {
		return fmt.Errorf(strJobAlreadyExists, jobId)
	}
	jm.Jobs[jobId] = job
	createEvt := &eventtypes.JobCreateEvent{
		Id:                  job.JobId(),
		Name:                job.Name(),
		TransferProfileName: job.TransferProfile().Name,
		Destination:         job.Destination(),
		Direction:           job.Direction(),
		Status:              string(job.Status()),
		Created:             job.TimestampCreated,
	}
	events.Events.Send(createEvt)
	return nil
}

func (jm *JobManager) DeleteJob(jobId string) error {
	jm.jobsLock.Lock()
	defer jm.jobsLock.Unlock()

	if _, exists := jm.Jobs[jobId]; !exists {
		return fmt.Errorf(strDeleteNonExistentJob, jobId)
	}
	delete(jm.Jobs, jobId)
	return nil
}

// GetJob returns a job object based on the job ID. Returns nil if the job does not exist.
func (jm *JobManager) GetJob(jobId string) *jobmanagertypes.Job {
	jm.jobsLock.Lock()
	defer jm.jobsLock.Unlock()
	return jm.Jobs[jobId]
}

//revive:disable:function-length,flag-parameter
func (jm *JobManager) DownloadJob(job *jobmanagertypes.Job) {
	transferProfile := job.TransferProfile()
	jobId := job.JobId()
	cfg := config.LoadConfiguration()

	// region Discover
	job.SetStatus(jobmanagertypes.JobStatusDiscovering)
	sess, sessErr := jm.GetS3Manager(transferProfile)
	if sessErr != nil {
		job.SetStatus(jobmanagertypes.JobStatusError)
		events.Events.Send(&eventtypes.JobErrorEvent{
			Id:        jobId,
			Name:      job.Name(),
			ErrorTime: time.Now(),
			Err:       fmt.Errorf(strFailedEstablishingAwsSession, sessErr),
		})
		time.Sleep(constants.SleepDuration)
		return
	}

	s3Discovery := s3_discovery.NewS3Discovery("", jobId, job.Destination(), job.S3PrefixToTrim())
	discoveredTasks, errors := s3Discovery.Discover(job.Sources(), *sess, &s3Discovery)
	for _, err := range errors {
		events.Events.Warn(strErrorDiscoveringObject, err)
	}
	for _, task := range discoveredTasks {
		task.SetStatus(jobmanagertypes.TaskStatusQueued)
	}
	//endregion

	// region Filter
	filteredTasks := discoveredTasks
	var forcedFilterList []filters.FileMoverFilter
	blockedPathsFilter, err := blockedPaths.NewBlockedPathsFilter(cfg.APIServer.BlockedPathList)
	if err != nil {
		events.Events.Fatal("Error while parsing blockedPaths: %s", err)
	} else {
		forcedFilterList = append(forcedFilterList, blockedPathsFilter)
	}
	filteredTasks = filterTasks(forcedFilterList, filteredTasks)

	var filterList []filters.FileMoverFilter
	maxAgeFilter, err := maxAge.NewMaxAgeFilter(config.ConvertMaxAgeToInt(transferProfile.MaxAge))
	if err != nil {
		events.Events.Warn("Error while parsing max age filter: %s", err)
	} else if maxAgeFilter != nil {
		filterList = append(filterList, maxAgeFilter)
	}
	inclusionFilter, err := inclusion.NewInclusionFilter(transferProfile.Filter)
	if err != nil {
		events.Events.Warn("Error while parsing inclusion filter: %s", err)
	} else if inclusionFilter != nil {
		filterList = append(filterList, inclusionFilter)
	}
	metadataFilter, err := metadata.NewMetadataFilter()
	if err != nil {
		events.Events.Warn("Error while parsing metadata filter: %s", err)
	} else if metadataFilter != nil && transferProfile.EnableMetadataFilter {
		filterList = append(filterList, metadataFilter)
	}
	fileExistsFilter, err := fileAlreadyExists.NewFileAlreadyExistsFilter(job)
	if err != nil {
		events.Events.Warn("Error while parsing File Already Exists filter: %s", err)
	} else if fileExistsFilter != nil {
		filterList = append(filterList, fileExistsFilter)
	}
	if !job.Force() {
		filteredTasks = filterTasks(filterList, filteredTasks)
	}
	//endregion

	var totalJobBytes int64
	for _, task := range filteredTasks {
		totalJobBytes += task.GetSize()
	}
	atomic.AddInt64(&job.TotalBytes, totalJobBytes)
	events.Events.Send(&eventtypes.JobProgressEvent{
		Id:               jobId,
		Name:             job.Name(),
		BytesTransferred: 0,
		TotalBytes:       totalJobBytes,
	})

	if len(filteredTasks) == 0 {
		job.SetStatus(jobmanagertypes.JobStatusCompleted)
		// TODO: Sleep needed here because the job complete event comes before the skip event,
		// even though the skip event is sent first. Need to investigate order of events for event bus
		time.Sleep(constants.SleepDuration)
		events.Events.Warn("No files to download")
		events.Events.Send(
			&eventtypes.JobCompleteEvent{
				Id:                 jobId,
				Name:               job.Name(),
				CompletionTime:     time.Now(),
				HasAllSkippedTasks: true,
				HasSuccessfulTasks: false,
				HasTaskErrors:      false,
			},
		)
		time.Sleep(constants.SleepDuration)
		return
	}

	// region Sort
	var sortList []sorting.FileMoverSorter
	fileExtSorter, err := fileExtSorting.New(transferProfile.FileOrder)
	if err != nil {
		events.Events.Warn("Error while parsing file_order: %s", err)
	} else if fileExtSorter != nil {
		sortList = append(sortList, fileExtSorter)
	}
	sortedTasks := sortTasks(filteredTasks, sortList)
	//endregion

	// region Transfer
	errors = jm.AddTasksForTransfer(sortedTasks, job)
	for _, err = range errors {
		events.Events.Warn("Unable to transfer task: %s", err)
	}
	cancelChan := make(chan bool)
	go sendJobProgress(job, cancelChan)
	sendEventWhenJobComplete(job, cancelChan)
	//endregion
}

//revive:enable:function-length,flag-parameter

//revive:disable:function-length,flag-parameter
func (jm *JobManager) UploadJob(job *jobmanagertypes.Job) {
	transferProfile := job.TransferProfile()
	jobId := job.JobId()
	cfg := config.LoadConfiguration()

	// region Discover
	job.SetStatus(jobmanagertypes.JobStatusDiscovering)

	localDiscovery := local_discovery.NewLocalDiscovery(job.Destination(), jobId, job.UploadBasePath())
	discoveredTasks, errors := localDiscovery.Discover(job.Sources())
	for _, err := range errors {
		events.Events.Warn("Error discovering file: %s", err)
	}
	for _, task := range discoveredTasks {
		task.SetStatus(jobmanagertypes.TaskStatusQueued)
	}
	//endregion

	// region Pre-Checksum Filter
	job.SetStatus(jobmanagertypes.JobStatusFiltering)
	filteredTasks := discoveredTasks
	var forcedFilterList []filters.FileMoverFilter
	blockedPathsFilter, err := blockedPaths.NewBlockedPathsFilter(cfg.APIServer.BlockedPathList)
	if err != nil {
		events.Events.Fatal("Error while parsing blockedPaths: %s", err)
	} else {
		forcedFilterList = append(forcedFilterList, blockedPathsFilter)
	}
	filteredTasks = filterTasks(forcedFilterList, filteredTasks)

	var filterList []filters.FileMoverFilter
	maxAgeFilter, err := maxAge.NewMaxAgeFilter(config.ConvertMaxAgeToInt(transferProfile.MaxAge))
	if err != nil {
		events.Events.Warn("Error while parsing max age filter: %s", err)
	} else if maxAgeFilter != nil {
		filterList = append(filterList, maxAgeFilter)
	}
	inclusionFilter, err := inclusion.NewInclusionFilter(transferProfile.Filter)
	if err != nil {
		events.Events.Warn("Error while parsing inclusion filter: %s", err)
	} else if inclusionFilter != nil {
		filterList = append(filterList, inclusionFilter)
	}
	metadataFilter, err := metadata.NewMetadataFilter()
	if err != nil {
		events.Events.Warn("Error while parsing metadata filter: %s", err)
	} else if metadataFilter != nil && transferProfile.EnableMetadataFilter {
		filterList = append(filterList, metadataFilter)
	}

	if !job.Force() {
		filteredTasks = filterTasks(filterList, filteredTasks)
	}

	if len(filteredTasks) == 0 {
		job.SetStatus(jobmanagertypes.JobStatusCompleted)
		// TODO: Sleep needed here because the job complete event comes before the skip event,
		// even though the skip event is sent first. Need to investigate order of events for event bus
		time.Sleep(constants.SleepDuration)
		events.Events.Warn("No files found for upload")
		events.Events.Send(
			&eventtypes.JobCompleteEvent{
				Id:                 jobId,
				Name:               job.Name(),
				CompletionTime:     time.Now(),
				HasAllSkippedTasks: true,
				HasSuccessfulTasks: false,
				HasTaskErrors:      false,
			},
		)
		time.Sleep(constants.SleepDuration)
		return
	}
	//endregion

	// region Sort
	var sortList []sorting.FileMoverSorter
	fileExtSorter, err := fileExtSorting.New(transferProfile.FileOrder)
	if err != nil {
		events.Events.Warn("Error while parsing file_order: %s", err)
	} else if fileExtSorter != nil {
		sortList = append(sortList, fileExtSorter)
	}
	filteredTasks = sortTasks(filteredTasks, sortList)
	//endregion

	// region Checksum
	job.SetStatus(jobmanagertypes.JobStatusChecksumming)
	checksumManager, err := checksumMgr.GetInstance(cfg.General.MaxActiveChecksums)
	if err != nil {
		job.SetStatus(jobmanagertypes.JobStatusError)
		events.Events.Send(&eventtypes.JobErrorEvent{
			Id:        jobId,
			Name:      job.Name(),
			ErrorTime: time.Now(),
			Err:       err,
		})
		time.Sleep(100 * time.Millisecond)
		return
	}
	checksumManager.ChecksumTasks(job.JobId(), filteredTasks, transferProfile.Checksums)
	//endregion

	// region Post-Checksum Filter
	job.SetStatus(jobmanagertypes.JobStatusFiltering)
	s3m, sessErr := jm.GetS3Manager(transferProfile)
	if sessErr != nil {
		events.Events.Warn("Error while starting an AWS session: %s", sessErr)
	}
	objectExistsFilter, err := objectAlreadyExists.NewObjectAlreadyExistsFilter(s3m, transferProfile.Checksums)
	if err != nil {
		events.Events.Warn("Error while parsing object exists filter: %s", err)
	} else if objectExistsFilter != nil {
		filterList = []filters.FileMoverFilter{objectExistsFilter}
	}

	if !job.Force() {
		filteredTasks = filterTasks(filterList, filteredTasks)
	}
	//endregion

	var totalJobBytes int64
	for _, task := range filteredTasks {
		totalJobBytes += task.GetSize()
	}
	atomic.AddInt64(&job.TotalBytes, totalJobBytes)
	events.Events.Send(&eventtypes.JobProgressEvent{
		Id:               jobId,
		Name:             job.Name(),
		BytesTransferred: 0,
		TotalBytes:       totalJobBytes,
	})

	if len(filteredTasks) == 0 {
		job.SetStatus(jobmanagertypes.JobStatusCompleted)
		// TODO: Sleep needed here because the job complete event comes before the skip event,
		// even though the skip event is sent first. Need to investigate order of events for event bus
		time.Sleep(constants.SleepDuration)
		events.Events.Warn("No files found for upload")
		events.Events.Send(
			&eventtypes.JobCompleteEvent{
				Id:                 jobId,
				Name:               job.Name(),
				CompletionTime:     time.Now(),
				HasAllSkippedTasks: true,
				HasSuccessfulTasks: false,
				HasTaskErrors:      false,
			},
		)
		time.Sleep(constants.SleepDuration)
		return
	}

	// Early exit if job was canceled during the checksum stage
	if job.Status() == jobmanagertypes.JobStatusCancelled {
		events.Events.Info(strJobCancelledDuringChecksum, job.Name())
		time.Sleep(100 * time.Millisecond)
		return
	}

	// region Transfer
	errors = jm.AddTasksForTransfer(filteredTasks, job)
	for _, err = range errors {
		events.Events.Warn("Unable to transfer task: %s", err)
	}
	progressChanCancel := make(chan bool)
	go sendJobProgress(job, progressChanCancel)
	sendEventWhenJobComplete(job, progressChanCancel)
	//endregion
}

func (jm *JobManager) GetJobs() []*fmev1.Job {
	jobs := make([]*fmev1.Job, 0)

	for _, job := range jm.Jobs {
		jobs = append(jobs, job.ToProtobuf())
	}

	return jobs
}

func (jm *JobManager) ClearCompletedJob(jobId string) error {
	job := jm.GetJob(jobId)
	if job == nil {
		return fmeErrors.ErrNoSuchJob
	}

	jm.jobsLock.Lock()
	defer jm.jobsLock.Unlock()

	if !slices.Contains(clearableStates, job.Status()) {
		return fmeErrors.ErrCannotClearActiveJob
	}

	delete(jm.Jobs, jobId)
	delete(jm.Tasks, jobId)

	return nil
}

func (jm *JobManager) ClearCompletedJobs() []string {
	jobIds := make([]string, 0)

	jm.jobsLock.Lock()
	defer jm.jobsLock.Unlock()

	for jobId, job := range jm.Jobs {
		if slices.Contains(clearableStates, job.Status()) {
			jobIds = append(jobIds, jobId)
			delete(jm.Jobs, jobId)
			delete(jm.Tasks, jobId)
		}
	}

	return jobIds
}

func sendJobProgress(job *jobmanagertypes.Job, cancelChan chan bool) {
	lastSent := time.Now()
	for {
		select {
		case <-cancelChan:
			return
		default:
			if job.Status() == jobmanagertypes.JobStatusPaused {
				continue
			}
			bytesUploaded := atomic.LoadInt64(&job.BytesUploaded)
			bytesDownloaded := atomic.LoadInt64(&job.BytesDownloaded)
			var bytesTransferred int64
			if job.Direction() == transfertypes.Upload {
				bytesTransferred = bytesUploaded
			} else {
				bytesTransferred = bytesDownloaded
			}
			if bytesTransferred < 0 {
				bytesTransferred = 0
			}
			if bytesTransferred > job.TotalBytes {
				bytesTransferred = job.TotalBytes
			}

			evt := eventtypes.JobProgressEvent{
				Id:               job.JobId(),
				Name:             job.Name(),
				BytesTransferred: bytesTransferred,
				TotalBytes:       job.TotalBytes,
			}
			now := time.Now()
			if now.Sub(lastSent) > 3*time.Second {
				events.Events.Send(&evt)
				lastSent = now
			}
			transferstats.ProgressChannel <- evt
			time.Sleep(100 * time.Millisecond)
		}
	}
}

//revive:enable:function-length,flag-parameter

func sortTasks(tasks []*jobmanagertypes.Task, sortList []sorting.FileMoverSorter) []*jobmanagertypes.Task {
	sortedTasks := tasks
	var err error
	for _, sorter := range sortList {
		sortedTasks, err = sorter.Sort(sortedTasks)
		if err != nil {
			events.Events.Warn("Error while sorting: %s", err)
		}
	}
	return sortedTasks
}

// SendEventWhenJobComplete waits for the job's waitGroup to finish, and sends a JobCompleteEvent once it is finished
func sendEventWhenJobComplete(job *jobmanagertypes.Job, cancelChan chan bool) {
	job.WaitGroup.Wait()
	cancelChan <- true

	storeDbObjects(job.DatabaseObjects())
	// TODO: This event sometimes triggers before the last Download/UploadCompleteEvent,
	// even though the Download/UploadCompleteEvent is sent first. Does the event bus respect the order that events
	// are triggered? For now, sleep is needed to force order of events
	time.Sleep(constants.SleepDuration)
	if job.Status() != jobmanagertypes.JobStatusError && job.Status() != jobmanagertypes.JobStatusCancelled {
		job.SetStatus(jobmanagertypes.JobStatusCompleted)
		events.Events.Send(
			&eventtypes.JobCompleteEvent{
				Id:                 job.JobId(),
				Name:               job.Name(),
				CompletionTime:     time.Now(),
				HasSuccessfulTasks: job.HasSuccessfulTasks(),
				HasTaskErrors:      job.HasTaskErrors(),
				HasAllSkippedTasks: false,
			},
		)
		time.Sleep(constants.SleepDuration)
	}
}

// TODO: Write unit test for this function
func filterTasks(filterList []filters.FileMoverFilter, tasks []*jobmanagertypes.Task) []*jobmanagertypes.Task {
	var filteredTasks []*jobmanagertypes.Task
	var err error
	for _, task := range tasks {
		shouldExclude := false
		for _, filter := range filterList {
			shouldExclude, err = filter.IsFiltered(task)
			if err != nil {
				events.Events.Warn("Error running filter: %s", err)
				continue
			}
			if shouldExclude {
				task.SetStatus(jobmanagertypes.TaskStatusSkipped)
				break
			}
		}
		if !shouldExclude {
			filteredTasks = append(filteredTasks, task)
		}
	}
	return filteredTasks
}

func storeDbObjects(dbObjects []*databasetypes.DatabaseObject) {
	if len(dbObjects) == 0 {
		return
	}
	db, err := databasetypes.New()
	if err != nil {
		events.Events.Warn(strErrorCreatingDb, err)
		return
	}
	err = db.BulkStoreObjects(dbObjects)
	if err != nil {
		events.Events.Warn(strErrorStoringDbObjects, err)
	}
}
