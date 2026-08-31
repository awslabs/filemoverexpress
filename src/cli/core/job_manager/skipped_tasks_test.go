package job_manager

import (
	"testing"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/types/transfertypes"
)

func newSkippedTestTask(t *testing.T, jobId, path string, size int64) *jobmanagertypes.Task {
	t.Helper()
	task, err := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		Destination:   "/s3/" + path,
		LocalFile:     jobmanagertypes.LocalFile{Path: path, Size: size},
		JobId:         jobId,
		TaskDirection: jobmanagertypes.TaskDirectionUpload,
	})
	if err != nil {
		t.Fatalf("NewTask(%q): %v", path, err)
	}
	return task
}

// AddSkippedTasks must register ONLY Skipped tasks on the job — so the GUI's
// total file count and Skipped tab include already-exists files — WITHOUT
// queueing them for transfer or adding their bytes to the job total. Regression
// test for skipped files vanishing from the job entirely (e.g. 54 submitted but
// only 34 shown with Skipped = 0).
func TestAddSkippedTasks_RegistersOnlySkippedWithoutQueuing(t *testing.T) {
	job, err := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
		Name:      "skippedTest",
		Direction: transfertypes.Upload,
		TransferProfile: &configtypes.TransferProfile{
			Name:         "skip-profile",
			Bucket:       "test-bucket",
			Region:       "us-west-2",
			Profile:      "test-profile",
			StorageClass: "standard",
		},
	})
	if err != nil {
		t.Fatalf("NewJob: %v", err)
	}
	jm := GetInstance()
	jobId := job.JobId()

	queued := newSkippedTestTask(t, jobId, "keep.txt", 10*constants.MiB)
	queued.SetStatus(jobmanagertypes.TaskStatusQueued)
	skipped1 := newSkippedTestTask(t, jobId, "exists1.txt", 20*constants.MiB)
	skipped1.SetStatus(jobmanagertypes.TaskStatusSkipped)
	skipped2 := newSkippedTestTask(t, jobId, "exists2.txt", 30*constants.MiB)
	skipped2.SetStatus(jobmanagertypes.TaskStatusSkipped)
	discovered := []*jobmanagertypes.Task{queued, skipped1, skipped2}

	queueLenBefore := jm.priorityQueue.Len()
	jm.AddSkippedTasks(discovered, job)

	registered := jm.GetTasks(jobId)
	if len(registered) != 2 {
		t.Fatalf("registered %d tasks, want 2 (only the skipped ones)", len(registered))
	}
	if _, ok := registered[skipped1.TaskId()]; !ok {
		t.Errorf("skipped1 not registered on job")
	}
	if _, ok := registered[skipped2.TaskId()]; !ok {
		t.Errorf("skipped2 not registered on job")
	}
	if _, ok := registered[queued.TaskId()]; ok {
		t.Errorf("queued (non-skipped) task must NOT be registered by AddSkippedTasks")
	}
	if got := jm.priorityQueue.Len(); got != queueLenBefore {
		t.Errorf("priority queue grew by %d; skipped tasks must never be queued", got-queueLenBefore)
	}
	if job.TotalBytes != 0 {
		t.Errorf("job.TotalBytes = %d, want 0; skipped tasks must not add bytes to the transfer total", job.TotalBytes)
	}

	// Idempotent: calling again (e.g. from a second filter stage) must not duplicate.
	jm.AddSkippedTasks(discovered, job)
	if got := len(jm.GetTasks(jobId)); got != 2 {
		t.Errorf("after second call registered %d tasks, want 2 (must be idempotent)", got)
	}
}
