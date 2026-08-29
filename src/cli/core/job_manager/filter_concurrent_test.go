package job_manager

import (
	"testing"

	"github.com/awslabs/filemoverexpress/core/filters"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	s3_sharedv1 "github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

// fakeFilter excludes any task whose local file path is in the exclude set.
type fakeFilter struct{ exclude map[string]bool }

func (f *fakeFilter) IsFiltered(task *jobmanagertypes.Task) (bool, error) {
	return f.exclude[task.LocalFile().Path], nil
}
func (*fakeFilter) FilteredReason() string { return "fake" }
func (*fakeFilter) SkipType() s3_sharedv1.SkippedState {
	return s3_sharedv1.SkippedState_SKIPPED_STATE_ALREADY_EXISTS
}

func newTaskWithPath(t *testing.T, path string) *jobmanagertypes.Task {
	t.Helper()
	task, err := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
		LocalFile: jobmanagertypes.LocalFile{Path: path},
	})
	if err != nil {
		t.Fatalf("NewTask(%q) error: %v", path, err)
	}
	return task
}

// filterTasksConcurrent must preserve input order for the kept tasks (downstream
// transfer priority depends on it) and mark excluded tasks as Skipped.
func TestFilterTasksConcurrent_PreservesOrderAndSkips(t *testing.T) {
	paths := []string{"a", "b", "c", "d", "e"}
	tasks := make([]*jobmanagertypes.Task, 0, len(paths))
	for _, p := range paths {
		tasks = append(tasks, newTaskWithPath(t, p))
	}
	ff := &fakeFilter{exclude: map[string]bool{"b": true, "d": true}}

	got := filterTasksConcurrent([]filters.FileMoverFilter{ff}, tasks, 4)

	want := []string{"a", "c", "e"}
	if len(got) != len(want) {
		t.Fatalf("kept %d tasks, want %d", len(got), len(want))
	}
	for i, task := range got {
		if task.LocalFile().Path != want[i] {
			t.Errorf("kept[%d] = %q, want %q (order not preserved)", i, task.LocalFile().Path, want[i])
		}
	}
	for _, task := range tasks {
		p := task.LocalFile().Path
		excluded := p == "b" || p == "d"
		if excluded && task.Status() != jobmanagertypes.TaskStatusSkipped {
			t.Errorf("task %q status = %v, want Skipped", p, task.Status())
		}
	}
}

// concurrency <= 0 must be clamped to serial (1), not panic or deadlock.
func TestFilterTasksConcurrent_ZeroConcurrencyClamped(t *testing.T) {
	tasks := []*jobmanagertypes.Task{newTaskWithPath(t, "x"), newTaskWithPath(t, "y")}
	got := filterTasksConcurrent([]filters.FileMoverFilter{&fakeFilter{exclude: map[string]bool{}}}, tasks, 0)
	if len(got) != 2 {
		t.Fatalf("kept %d tasks, want 2", len(got))
	}
}
