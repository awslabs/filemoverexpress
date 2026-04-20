package threadsafetypes

import "sync"

// SafeIntMap is a concurrency-safe map, to avoid race conditions
type SafeIntMap struct {
	sync.RWMutex
	M map[string]int
}

func (sim *SafeIntMap) Get(key string) (value int, ok bool) {
	sim.RLock()
	result, ok := sim.M[key]
	sim.RUnlock()
	return result, ok
}

func (sim *SafeIntMap) Set(key string, value int) {
	sim.Lock()
	sim.M[key] = value
	sim.Unlock()
}

func (sim *SafeIntMap) Increment(name string) {
	sim.Lock()
	sim.M[name]++
	sim.Unlock()
}

func (sim *SafeIntMap) Delete(key string) {
	sim.Lock()
	delete(sim.M, key)
	sim.Unlock()
}
