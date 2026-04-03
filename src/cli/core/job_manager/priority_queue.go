package job_manager

import (
    "cmp"
    "slices"
    "sync"

    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

type PriorityQueue struct {
    queue []*jobmanagertypes.Task
    lock  *sync.RWMutex
}

func NewPriorityQueue() *PriorityQueue {
    return &PriorityQueue{
        queue: make([]*jobmanagertypes.Task, 0),
        lock:  &sync.RWMutex{},
    }
}

func (pq *PriorityQueue) Push(task *jobmanagertypes.Task) {
    pq.lock.Lock()
    defer pq.lock.Unlock()

    pq.queue = append(pq.queue, task)
    pq.Sort()
}

func (pq *PriorityQueue) PushBulk(tasks []*jobmanagertypes.Task) {
    pq.lock.Lock()
    defer pq.lock.Unlock()
    pq.queue = append(pq.queue, tasks...)
    pq.Sort()
}

func (pq *PriorityQueue) Len() int {
    pq.lock.RLock()
    defer pq.lock.RUnlock()
    return len(pq.queue)
}

func (pq *PriorityQueue) Pop() *jobmanagertypes.Task {
    pq.lock.Lock()
    defer pq.lock.Unlock()
    pqLen := len(pq.queue)
    if pqLen > 0 {
        task := pq.queue[pqLen-1]
        pq.queue = pq.queue[0 : pqLen-1]
        return task
    }
    return nil
}

func (pq *PriorityQueue) Sort() {
    slices.SortFunc(pq.queue, func(a, b *jobmanagertypes.Task) int {
        return cmp.Compare(a.Priority(), b.Priority())
    })
}
