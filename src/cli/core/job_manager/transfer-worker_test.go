package job_manager

import (
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/awslabs/filemoverexpress/constants"
	transferapi "github.com/awslabs/filemoverexpress/core/transfer-api"
	"github.com/awslabs/filemoverexpress/core/transfer-api/mock"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/transfertypes"
)

func TestJobManager_DoSingleTransfer(t *testing.T) {
	job1, _ := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
		Name:      "testJob",
		Direction: transfertypes.Download,
		TransferProfile: &configtypes.TransferProfile{
			Name:         "test-profile1",
			Bucket:       "test-bucket",
			Region:       "us-west-2",
			Profile:      "test-profile",
			StorageClass: "standard",
		},
	})
	job2, _ := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
		Name:      "testJob",
		Direction: transfertypes.Upload,
		TransferProfile: &configtypes.TransferProfile{
			Name:         "test-profile2",
			Bucket:       "test-bucket",
			Region:       "us-west-2",
			Profile:      "test-profile",
			StorageClass: "standard",
		},
	})
	job3, _ := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
		Name:      "testJob2",
		Direction: transfertypes.Upload,
		TransferProfile: &configtypes.TransferProfile{
			Name:         "test-profile3",
			Bucket:       "test-bucket",
			Region:       "us-west-2",
			Profile:      "test-profile",
			StorageClass: "standard",
		},
	})
	InvalidStorageClassJob, _ := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
		Name:      "invalidTestJob",
		Direction: transfertypes.Upload,
		TransferProfile: &configtypes.TransferProfile{
			Name:         "test-name",
			Bucket:       "test-bucket",
			Region:       "us-west-2",
			Profile:      "test-profile",
			StorageClass: "invalid-storage-class",
		},
	})
	downloadTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		Destination: "/tmp/TestJobManager_DoSingleTransfer/test.txt",
		LocalFile:   jobmanagertypes.LocalFile{},
		S3Object: jobmanagertypes.S3Object{
			Key:          "test.txt",
			LastModified: time.Now(),
			Size:         10 * constants.MiB,
		},
		JobId:         job1.JobId(),
		TaskDirection: jobmanagertypes.TaskDirectionDownload,
		Priority:      0,
	})
	uploadTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		Destination: "/s3/path/test.txt",
		LocalFile: jobmanagertypes.LocalFile{
			LastModified: time.Now(),
			Path:         "/tmp/TestJobManager_DoSingleTransfer/test.txt",
			Size:         10 * constants.MiB,
		},
		S3Object:      jobmanagertypes.S3Object{},
		JobId:         job2.JobId(),
		TaskDirection: jobmanagertypes.TaskDirectionUpload,
		Priority:      0,
	})
	badUploadTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		Destination: "/s3/path/test.txt",
		LocalFile: jobmanagertypes.LocalFile{
			LastModified: time.Now(),
			Path:         "/tmp/TestJobManager_DoSingleTransfer/doesNotExist.txt",
			Size:         10 * constants.MiB,
		},
		S3Object:      jobmanagertypes.S3Object{},
		JobId:         job3.JobId(),
		TaskDirection: jobmanagertypes.TaskDirectionUpload,
		Priority:      0,
	})
	InvalidStorageClassTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		Destination: "/s3/path/test.txt",
		LocalFile: jobmanagertypes.LocalFile{
			LastModified: time.Now(),
			Path:         "/tmp/TestJobManager_DoSingleTransfer/test.txt",
			Size:         10 * constants.MiB,
		},
		S3Object:      jobmanagertypes.S3Object{},
		JobId:         InvalidStorageClassJob.JobId(),
		TaskDirection: jobmanagertypes.TaskDirectionUpload,
		Priority:      0,
	})
	s3m := &transferapi.S3Manager{
		AwsProfile: "test-profile",
		Bucket:     "test-bucket",
		Client:     &mock.FileMoverS3Client{},
		Downloader: nil,
		Region:     "us-west-2",
		Lock:       &sync.RWMutex{},
	}
	type fields struct {
		Tasks          map[string]map[string]*jobmanagertypes.Task
		Jobs           map[string]*jobmanagertypes.Job
		s3ManagerCache map[string]*transferapi.S3Manager
		tasksLock      *sync.Mutex
		jobsLock       *sync.Mutex
	}
	type args struct {
		task *jobmanagertypes.Task
	}
	tests := []struct {
		name                         string
		fields                       fields
		args                         args
		jobTotalBytes                int64
		expectedTaskStatus           jobmanagertypes.TaskStatus
		expectedJobBytesTransferred  int64
		expectedTaskBytesTransferred int64
		job                          *jobmanagertypes.Job
	}{
		{
			name:                         "Download task",
			args:                         args{task: downloadTask},
			jobTotalBytes:                10 * constants.MiB,
			expectedTaskStatus:           jobmanagertypes.TaskStatusCompleted,
			expectedJobBytesTransferred:  10 * constants.MiB,
			expectedTaskBytesTransferred: 10 * constants.MiB,
			job:                          job1,
		},
		{
			name:                         "Upload task",
			args:                         args{task: uploadTask},
			jobTotalBytes:                10 * constants.MiB,
			expectedTaskStatus:           jobmanagertypes.TaskStatusCompleted,
			expectedJobBytesTransferred:  10 * constants.MiB,
			expectedTaskBytesTransferred: 10 * constants.MiB,
			job:                          job2,
		},
		{
			name:                         "Upload task should fail",
			args:                         args{task: badUploadTask},
			jobTotalBytes:                10 * constants.MiB,
			expectedTaskStatus:           jobmanagertypes.TaskStatusError,
			expectedJobBytesTransferred:  0 * constants.MiB,
			expectedTaskBytesTransferred: 0 * constants.MiB,
			job:                          job3,
		},
		{
			name:                         "task with invalid storage class, should default to standard",
			args:                         args{task: InvalidStorageClassTask},
			jobTotalBytes:                10 * constants.MiB,
			expectedTaskStatus:           jobmanagertypes.TaskStatusCompleted,
			expectedJobBytesTransferred:  10 * constants.MiB,
			expectedTaskBytesTransferred: 10 * constants.MiB,
			job:                          InvalidStorageClassJob,
		},
	}
	if mkdirErr := os.MkdirAll("/tmp/TestJobManager_DoSingleTransfer/", os.ModePerm); mkdirErr != nil {
		t.Errorf("TestTransferTask(): Error creating temp dir: %v", mkdirErr)
	}
	if _, createErr := os.Create("/tmp/TestJobManager_DoSingleTransfer/test.txt"); createErr != nil {
		t.Errorf("TestTransferTask(): Error creating temp file: %v", createErr)
	}
	jm := GetInstance()
	endpoint := ""
	key := strings.Join([]string{s3m.AwsProfile, s3m.Bucket, s3m.Region, endpoint}, "-")
	jm.s3ManagerCache[key] = s3m

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			atomic.StoreInt64(&tt.job.TotalBytes, tt.jobTotalBytes)
			err := jm.AddJob(tt.job)
			if err != nil {
				t.Errorf("DoSingleTransfer(): Error creating job")
			}
			// Normally would call AddTasksForTransfer here instead of manually adding to the wg, but that puts the task on the queue,
			// which would then have a worker call DoSingleTransfer. We want to call DoSingleTransfer ourselves here
			tt.job.WaitGroup.Add(1)

			jm.DoSingleTransfer(tt.args.task)
			if tt.args.task.Status() != tt.expectedTaskStatus {
				t.Errorf("DoSingleTransfer() task Status = %s, want %s. err = %v", tt.args.task.Status(), tt.expectedTaskStatus,
					tt.args.task.Err())
			}
			// check bytes transferred on task and job structs
			var jobBytesTransferred int64
			if tt.job.Direction() == transfertypes.Upload {
				jobBytesTransferred = tt.job.BytesUploaded
			} else if tt.job.Direction() == transfertypes.Download {
				jobBytesTransferred = tt.job.BytesDownloaded
			}
			if jobBytesTransferred != tt.expectedJobBytesTransferred {
				t.Errorf("TransferTask(): Got incorrect bytes transferred on job for test %s, expected %d, got %d",
					tt.name,
					tt.expectedJobBytesTransferred,
					jobBytesTransferred)
			}
			if tt.args.task.BytesTransferred != tt.expectedTaskBytesTransferred {
				t.Errorf("TransferTask(): Got incorrect bytes transferred on task for test %s, expected %d, got %d",
					tt.name,
					tt.expectedTaskBytesTransferred,
					tt.args.task.BytesTransferred)
			}
		})
	}
	if removeErr := os.RemoveAll("/tmp/TestJobManager_DoSingleTransfer"); removeErr != nil {
		t.Logf("TestTransferTask(): Error removing temp dir: %v", removeErr)
	}
}

func TestTransferTask(t *testing.T) {
	job1, _ := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
		Name: "testJob",
		TransferProfile: &configtypes.TransferProfile{
			Name:         "test-profile1",
			Bucket:       "test-bucket",
			Region:       "us-west-2",
			Profile:      "test-profile",
			StorageClass: "standard",
		},
	})
	job2, _ := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
		Name: "testJob",
		TransferProfile: &configtypes.TransferProfile{
			Name:         "test-profile2",
			Bucket:       "test-bucket",
			Region:       "us-west-2",
			Profile:      "test-profile",
			StorageClass: "standard",
		},
	})
	job3, _ := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
		Name: "testJob",
		TransferProfile: &configtypes.TransferProfile{
			Name:         "test-profile3",
			Bucket:       "test-bucket",
			Region:       "us-west-2",
			Profile:      "test-profile",
			StorageClass: "standard",
		},
	})
	downloadTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		Destination: "/tmp/TestTransferTask/test.txt",
		LocalFile:   jobmanagertypes.LocalFile{},
		S3Object: jobmanagertypes.S3Object{
			Key:          "test.txt",
			LastModified: time.Now(),
			Size:         10 * constants.MiB,
		},
		TaskDirection: jobmanagertypes.TaskDirectionDownload,
		Priority:      0,
	})
	uploadTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		Destination: "/s3/path/test.txt",
		LocalFile: jobmanagertypes.LocalFile{
			LastModified: time.Now(),
			Path:         "/tmp/TestTransferTask/test.txt",
			Size:         10 * constants.MiB,
		},
		S3Object:      jobmanagertypes.S3Object{},
		JobId:         job2.JobId(),
		TaskDirection: jobmanagertypes.TaskDirectionUpload,
		Priority:      0,
	})
	unknownDirectionTask, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		Destination: "/s3/path/test.txt",
		LocalFile: jobmanagertypes.LocalFile{
			LastModified: time.Now(),
			Path:         "/tmp/TestTransferTask/test.txt",
			Size:         10 * constants.MiB,
		},
		S3Object:      jobmanagertypes.S3Object{},
		JobId:         job3.JobId(),
		TaskDirection: "Unknown Direction",
		Priority:      0,
	})
	s3m := &transferapi.S3Manager{
		AwsProfile: "test-profile",
		Bucket:     "test-bucket",
		Client:     &mock.FileMoverS3Client{},
		Downloader: nil,
		Region:     "us-west-2",
		Lock:       &sync.RWMutex{},
	}
	type args struct {
		task      *jobmanagertypes.Task
		job       *jobmanagertypes.Job
		s3Manager *transferapi.S3Manager
	}
	tests := []struct {
		name    string
		args    args
		wantErr bool
	}{
		{
			name: "Upload successful",
			args: args{
				task:      uploadTask,
				job:       job1,
				s3Manager: s3m,
			},
			wantErr: false,
		},
		{
			name: "Download successful",
			args: args{
				task:      downloadTask,
				job:       job2,
				s3Manager: s3m,
			},
			wantErr: false,
		},
		{
			name: "Invalid task direction",
			args: args{
				task:      unknownDirectionTask,
				job:       job3,
				s3Manager: s3m,
			},
			wantErr: true,
		},
	}
	if mkdirErr := os.MkdirAll("/tmp/TestTransferTask/", os.ModePerm); mkdirErr != nil {
		t.Errorf("TestTransferTask(): Error creating temp dir: %v", mkdirErr)
	}
	if _, createErr := os.Create("/tmp/TestTransferTask/test.txt"); createErr != nil {
		t.Errorf("TestTransferTask(): Error creating temp file: %v", createErr)
	}
	jm := GetInstance()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_ = jm.AddJob(tt.args.job)
			errs := jm.AddTasksForTransfer([]*jobmanagertypes.Task{tt.args.task}, tt.args.job)
			if len(errs) != 0 {
				t.Errorf("DoSingleTransfer(): Error calling AddTasksForTransfer()")
			}
			if err := TransferTask(tt.args.task, tt.args.job, tt.args.s3Manager); (err != nil) != tt.wantErr {
				t.Errorf("TransferTask() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
	if removeErr := os.RemoveAll("/tmp/TestTransferTask"); removeErr != nil {
		t.Logf("TestTransferTask(): Error removing temp dir: %v", removeErr)
	}
}

// TestFinishTask_DecrementsExactlyOnce is a regression test for the daemon crash
// where cancelling a job while a transfer worker was picking up the same task
// caused job.WaitGroup.Done() to be called twice, driving the counter negative
// and panicking the whole daemon (issue: "negative WaitGroup counter" on cancel).
//
// finishTask must decrement the WaitGroup exactly once per task no matter how
// many callers (cancel path + worker path) race to finish it.
func TestFinishTask_DecrementsExactlyOnce(t *testing.T) {
	job, err := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
		Name:      "raceJob",
		Direction: transfertypes.Upload,
		TransferProfile: &configtypes.TransferProfile{
			Name:         "race-profile",
			Bucket:       "test-bucket",
			Region:       "us-west-2",
			Profile:      "test-profile",
			StorageClass: "standard",
		},
	})
	if err != nil {
		t.Fatalf("NewJob() error = %v", err)
	}
	task, err := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		Destination:   "/s3/path/race.txt",
		LocalFile:     jobmanagertypes.LocalFile{Path: "/tmp/race.txt", Size: 1},
		JobId:         job.JobId(),
		TaskDirection: jobmanagertypes.TaskDirectionUpload,
	})
	if err != nil {
		t.Fatalf("NewTask() error = %v", err)
	}

	// One Add for the single task, mirroring AddTasksForTransfer.
	job.WaitGroup.Add(1)

	// Many goroutines race to finish the same task, simulating CancelJob and the
	// transfer worker both reaching a Done() for it. Before the fix this panicked.
	const racers = 64
	var start sync.WaitGroup
	start.Add(1)
	var done sync.WaitGroup
	done.Add(racers)
	for i := 0; i < racers; i++ {
		go func() {
			defer done.Done()
			start.Wait()
			finishTask(job, task)
		}()
	}
	start.Done()
	done.Wait()

	// Exactly one Done should have landed, so Wait returns promptly. A hang means
	// finishTask decremented zero times; a panic above would mean more than once.
	waited := make(chan struct{})
	go func() {
		job.WaitGroup.Wait()
		close(waited)
	}()
	select {
	case <-waited:
	case <-time.After(2 * time.Second):
		t.Fatal("WaitGroup never reached zero; finishTask did not decrement exactly once")
	}

	if task.MarkFinished() {
		t.Error("MarkFinished() returned true after the task was already finished")
	}
}
