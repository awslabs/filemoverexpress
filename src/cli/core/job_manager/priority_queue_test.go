package job_manager

import (
    "testing"

    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

func TestNewPriorityQueue(t *testing.T) {
    tests := []struct {
        name string
        want PriorityQueue
    }{
        {
            name: "Create Priority Queue",
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := NewPriorityQueue()
            if got.queue == nil {
                t.Errorf("NewPriorityQueue() queue is nil, wanted non-nil")
            }
        })
    }
}

func TestPriorityQueue_Len(t *testing.T) {
    pq := NewPriorityQueue()
    pq2 := NewPriorityQueue()
    task, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
        Priority: 0,
    })
    pq2.Push(task)
    pq2.Push(task)

    tests := []struct {
        name string
        pq   *PriorityQueue
        want int
    }{
        {
            name: "Empty queue",
            pq:   pq,
            want: 0,
        },
        {
            name: "Queue with two items",
            pq:   pq2,
            want: 2,
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {

            if got := tt.pq.Len(); got != tt.want {
                t.Errorf("Len() = %v, want %v", got, tt.want)
            }
        })
    }
}

func TestPriorityQueue_Pop(t *testing.T) {
    emptyPq := NewPriorityQueue()
    pq := NewPriorityQueue()
    task1, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
        Priority: 10,
    })
    task2, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
        Priority: 30,
    })
    task3, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
        Priority: 20,
    })
    pq.Push(task1)
    pq.Push(task2)
    pq.Push(task3)
    tests := []struct {
        name         string
        wantNil      bool
        wantPriority int
        pq           *PriorityQueue
    }{
        {
            name:         "Pop when empty",
            wantNil:      true,
            wantPriority: 0,
            pq:           emptyPq,
        },
        {
            name:         "Pop should get highest priority",
            wantNil:      false,
            wantPriority: 30,
            pq:           pq,
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := tt.pq.Pop()
            if tt.wantNil && got != nil {
                t.Errorf("Pop() Expected nil, got %v", got)
            }
            if got != nil && got.Priority() != tt.wantPriority {
                t.Errorf("Pop() priority = %d, want %d", got.Priority(), tt.wantPriority)
            }
        })
    }
}

func TestPriorityQueue_PushBulk(t *testing.T) {
    task1, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
        Priority: 10,
    })
    task2, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
        Priority: 30,
    })
    task3, _ := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
        Priority: 20,
    })
    type args struct {
        tasks []*jobmanagertypes.Task
    }
    tests := []struct {
        name    string
        args    args
        wantLen int
    }{
        {
            name:    "Push single task",
            args:    args{tasks: []*jobmanagertypes.Task{task1}},
            wantLen: 1,
        },
        {
            name:    "Push multiple tasks",
            args:    args{tasks: []*jobmanagertypes.Task{task1, task2, task3}},
            wantLen: 3,
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            pq := NewPriorityQueue()
            pq.PushBulk(tt.args.tasks)
            if pq.Len() != tt.wantLen {
                t.Errorf("PushBulk() len = %d, want %d", pq.Len(), tt.wantLen)
            }
        })
    }
}
