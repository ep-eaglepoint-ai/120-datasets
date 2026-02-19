package main

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// --- Shared Mock Store ---
type entry struct {
	val []byte
	rev int64
	ttl time.Time
	// original TTL for this lease, captured on acquisition so that
	// renewals can extend based on the same duration without needing
	// a ttl parameter on CompareAndSwap.
	leaseTTL time.Duration
}

type MockStore struct {
	mu         sync.Mutex
	data       map[string]*entry
	globalRev  int64
	watchers   map[string][]*watcher
	partitions int32 // 0 = healthy, 1 = partitioned
	// when true, CompareAndSwap will simulate a partial write: it will
	// mutate the underlying entry but report an error back to the
	// caller, allowing tests to verify that the orchestrator fails
	// safely under such conditions.
	partialWriteMode int32

	activeWatchers int32
	watchCalls     int64
	putCalls       int64
}

type watcher struct {
	ch   chan struct{}
	once sync.Once
}

func (w *watcher) close() {
	w.once.Do(func() {
		close(w.ch)
	})
}

func NewMockStore() *MockStore {
	return &MockStore{
		data:     make(map[string]*entry),
		watchers: make(map[string][]*watcher),
	}
}

// --- Instrumentation helpers (tests only) ---

func (m *MockStore) PutIfAbsentCalls() int64 {
	return atomic.LoadInt64(&m.putCalls)
}

func (m *MockStore) WatchCalls() int64 {
	return atomic.LoadInt64(&m.watchCalls)
}

func (m *MockStore) ActiveWatchers() int32 {
	return atomic.LoadInt32(&m.activeWatchers)
}

func (m *MockStore) ActiveWatchersForKey(key string) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.watchers[key])
}

// ForceOverwrite simulates an administrative preemption by overwriting
// the key with a new revision and value.
func (m *MockStore) ForceOverwrite(key string, val []byte, ttl time.Duration) int64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.globalRev++
	now := time.Now()
	m.data[key] = &entry{val: val, rev: m.globalRev, ttl: now.Add(ttl), leaseTTL: ttl}
	return m.globalRev
}

func (m *MockStore) SetPartition(active bool) {
	if active {
		atomic.StoreInt32(&m.partitions, 1)
	} else {
		atomic.StoreInt32(&m.partitions, 0)
	}
}

func (m *MockStore) checkPartition() error {
	if atomic.LoadInt32(&m.partitions) == 1 {
		time.Sleep(100 * time.Millisecond) // Simulate network timeout
		return errors.New("network partition")
	}
	return nil
}

// SetPartialWriteMode toggles a simulation mode where CompareAndSwap
// performs the underlying state mutation but still returns an error to
// the caller, mimicking a "partial write" failure at the storage
// layer.
func (m *MockStore) SetPartialWriteMode(active bool) {
	if active {
		atomic.StoreInt32(&m.partialWriteMode, 1)
	} else {
		atomic.StoreInt32(&m.partialWriteMode, 0)
	}
}

// --- Store Interface Implementation ---

func (m *MockStore) PutIfAbsent(ctx context.Context, key string, val []byte, ttl time.Duration) (int64, bool, error) {
	atomic.AddInt64(&m.putCalls, 1)
	if err := m.checkPartition(); err != nil { return 0, false, err }
	m.mu.Lock(); defer m.mu.Unlock()
	m.expireLocked(key)

	if _, exists := m.data[key]; exists { return 0, false, nil }

	m.globalRev++
	now := time.Now()
	m.data[key] = &entry{val: val, rev: m.globalRev, ttl: now.Add(ttl), leaseTTL: ttl}
	return m.globalRev, true, nil
}

func (m *MockStore) CompareAndSwap(ctx context.Context, key string, oldRev int64, newVal []byte) (bool, error) {
	if err := m.checkPartition(); err != nil { return false, err }
	m.mu.Lock(); defer m.mu.Unlock()
	m.expireLocked(key)

	e, exists := m.data[key]
	if !exists || e.rev != oldRev { return false, nil }

	// CAS-delete: nil value deletes the key.
	if newVal == nil {
		delete(m.data, key)
		m.notifyWatchers(key)
		return true, nil
	}

	// Apply the value change and TTL extension first, so that when
	// partialWriteMode is enabled we still mutate state but report an
	// error back to the caller.
	e.val = newVal
	if e.leaseTTL > 0 {
		e.ttl = time.Now().Add(e.leaseTTL)
	}

	if atomic.LoadInt32(&m.partialWriteMode) == 1 {
		// Simulate a storage layer that applied the write but could not
		// confirm success to the client.
		return false, errors.New("simulated partial write")
	}

	return true, nil
}

func (m *MockStore) Watch(ctx context.Context, key string) <-chan struct{} {
	atomic.AddInt64(&m.watchCalls, 1)
	atomic.AddInt32(&m.activeWatchers, 1)

	w := &watcher{ch: make(chan struct{}, 1)}

	m.mu.Lock()
	m.watchers[key] = append(m.watchers[key], w)
	m.mu.Unlock()

	// Ensure watchers respect cancellation and don't leak.
	go func() {
		select {
		case <-ctx.Done():
			m.mu.Lock()
			removed := m.removeWatcherLocked(key, w)
			m.mu.Unlock()
			if removed {
				w.close()
				atomic.AddInt32(&m.activeWatchers, -1)
			}
		case <-w.ch:
			// Notified normally.
		}
	}()

	return w.ch
}

func (m *MockStore) Get(ctx context.Context, key string) ([]byte, int64, error) {
	if err := m.checkPartition(); err != nil { return nil, 0, err }
	m.mu.Lock(); defer m.mu.Unlock()
	m.expireLocked(key)
	e, exists := m.data[key]
	if !exists {
		return nil, 0, nil
	}
	valCopy := append([]byte(nil), e.val...)
	return valCopy, e.rev, nil
}

func (m *MockStore) expireLocked(key string) {
	if e, exists := m.data[key]; exists {
		if time.Now().After(e.ttl) {
			delete(m.data, key)
			m.notifyWatchers(key)
		}
	}
}

func (m *MockStore) notifyWatchers(key string) {
	list, ok := m.watchers[key]
	if !ok || len(list) == 0 {
		return
	}

	// Wake ALL waiters to simulate etcd-style watch notification.
	delete(m.watchers, key)
	for _, w := range list {
		w.close()
		atomic.AddInt32(&m.activeWatchers, -1)
	}
}

func (m *MockStore) removeWatcherLocked(key string, target *watcher) bool {
	list, ok := m.watchers[key]
	if !ok {
		return false
	}
	for i := range list {
		if list[i] == target {
			// Remove without preserving order (order isn't important for cancellation).
			last := len(list) - 1
			list[i] = list[last]
			list = list[:last]
			if len(list) == 0 {
				delete(m.watchers, key)
			} else {
				m.watchers[key] = list
			}
			return true
		}
	}
	return false
}

// --- Legacy Adapter (Does not import repo, just satisfies interface) ---
type LegacyStoreAdapter struct {
	*MockStore
}
func (a *LegacyStoreAdapter) CompareAndSwap(ctx context.Context, key string, oldRevision int64, newVal []byte) (bool, error) {
	// Legacy interface already matches the 4-arg signature; simply
	// forward the call to the underlying mock store.
	return a.MockStore.CompareAndSwap(ctx, key, oldRevision, newVal)
}

// --- Shared Test Logic ---
func SharedConcurrencyTest(t *testing.T, factory func(id int, store *MockStore) (context.Context, int64, func(), error)) {
	store := NewMockStore()
	// High-concurrency scenario to match requirement: 50 goroutines
	// competing for the same resource.
	workerCount := 50

	var activeWorkers int32
	seenTokens := make(map[int64]struct{})
	var tokensInAcquisitionOrder []int64
	var mu sync.Mutex
	var wg sync.WaitGroup

	wg.Add(workerCount)
	startCh := make(chan struct{})

	for i := 0; i < workerCount; i++ {
		go func(id int) {
			defer wg.Done()
			<-startCh

			ctx, token, release, err := factory(id, store)
			if err != nil { return }
			if ctx == nil {
				t.Errorf("[SAFETY FAIL] nil context returned for worker %d", id)
				return
			}

			current := atomic.AddInt32(&activeWorkers, 1)
			if current > 1 {
				t.Errorf("[SAFETY FAIL] Mutual Exclusion Violated! %d workers hold lock simultaneously.", current)
			}

			mu.Lock()
			if _, exists := seenTokens[token]; exists {
				t.Errorf("[SAFETY FAIL] Duplicate fencing token observed: %d", token)
			}
			seenTokens[token] = struct{}{}
			tokensInAcquisitionOrder = append(tokensInAcquisitionOrder, token)
			mu.Unlock()

			time.Sleep(20 * time.Millisecond)

			atomic.AddInt32(&activeWorkers, -1)
			release()
		}(i)
	}

	close(startCh)
	wg.Wait()

	mu.Lock()
	defer mu.Unlock()

	if len(tokensInAcquisitionOrder) == 0 {
		t.Log("No tokens acquired (or all failed silently)")
	}

	// Since only one worker can hold the lock at a time and each worker
	// appends its token immediately after acquisition, this slice
	// represents issuance (acquisition) order.
	for i := 0; i < len(tokensInAcquisitionOrder)-1; i++ {
		if tokensInAcquisitionOrder[i] >= tokensInAcquisitionOrder[i+1] {
			t.Errorf("[SAFETY FAIL] Fencing Token Violation! Token %d is not > %d", tokensInAcquisitionOrder[i+1], tokensInAcquisitionOrder[i])
		}
	}
}