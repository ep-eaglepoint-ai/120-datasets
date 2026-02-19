//go:build after

package main

import (
	"context"
	"fmt"
	"testing"
	"time"

	repoAfter "lcxbi7-go-linearizable-sequence-lease-manager/repository_after"
)

// Requirement 7: ONE test with 50 goroutines validating:
// 1) mutual exclusion
// 2) fencing tokens strictly increasing
// 3) partition causes cancellation before TTL
func TestRepository_After_Requirement7_HighConcurrencyAndPartition(t *testing.T) {
	t.Log(">>> [Req7] Concurrency + Tokens + Partition Cancel (Expected to PASS) <<<")

	// Phase A: 50 goroutines contend for the same lock.
	SharedConcurrencyTest(t, func(id int, store *MockStore) (context.Context, int64, func(), error) {
		lm := repoAfter.NewLeaseManager(store, fmt.Sprintf("worker-%d", id), 200*time.Millisecond)
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		workerCtx, token, err := lm.AcquireAndHold(ctx, "resource-1")
		if err != nil {
			cancel()
			return nil, 0, nil, err
		}
		return workerCtx, token, func() {
			_ = lm.Release(context.Background(), "resource-1", token)
			cancel()
		}, nil
	})

	// Phase B: partition causes the holder's context to be canceled before TTL.
	store := NewMockStore()
	ttl := 1 * time.Second
	lm := repoAfter.NewLeaseManager(store, "zombie-worker", ttl)

	workerCtx, token, err := lm.AcquireAndHold(context.Background(), "critical-resource")
	if err != nil {
		t.Fatalf("Acquire failed: %v", err)
	}
	_ = token

	store.SetPartition(true)
	startTime := time.Now()
	select {
	case <-workerCtx.Done():
		elapsed := time.Since(startTime)
		if elapsed >= ttl {
			t.Errorf("Safety Violation: context canceled at or AFTER TTL expired (elapsed=%v, ttl=%v)", elapsed, ttl)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Failure: Zombie detected! worker context remained active despite partition")
	}
}

// TEST 3: Partial Write Failures
// Validates robustness against storage-layer partial writes
func TestRepository_After_PartialWriteFailures(t *testing.T) {
	t.Log(">>> [3/3] Testing Partial Write Failures (Expected to PASS) <<<")

	store := NewMockStore()
	// Enable simulated partial writes on CAS operations.
	store.SetPartialWriteMode(true)

	ttl := 1 * time.Second
	lm := repoAfter.NewLeaseManager(store, "partial-worker", ttl)

	workerCtx, _, err := lm.AcquireAndHold(context.Background(), "partial-resource")
	if err != nil {
		t.Fatalf("Acquire failed under partial-write mode: %v", err)
	}

	startTime := time.Now()

	select {
	case <-workerCtx.Done():
		elapsed := time.Since(startTime)
		t.Logf("Success: Worker context canceled after %v under partial writes (TTL was %v)", elapsed, ttl)

		// Even though the store may be extending TTL internally, the
		// orchestrator must revoke the lease before the logical TTL a
		// healthy node would assume.
		if elapsed >= ttl {
			t.Errorf("Safety Violation: Context canceled at or AFTER TTL expired under partial writes (elapsed=%v, ttl=%v)", elapsed, ttl)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Failure: Worker context remained active despite repeated partial-write failures.")
	}
}

// TEST 4: Admin Preemption / Atomic Revocation
// Validates: Req 3 (CAS mismatch cancels immediately), plus the "admin preemption" scenario.
func TestRepository_After_AdminPreemptionCancelsWorker(t *testing.T) {
	t.Log(">>> [4/5] Testing Admin Preemption Cancels Worker (Expected to PASS) <<<")

	store := NewMockStore()
	ttl := 600 * time.Millisecond
	lm := repoAfter.NewLeaseManager(store, "worker", ttl)

	workerCtx, _, err := lm.AcquireAndHold(context.Background(), "admin-resource")
	if err != nil {
		t.Fatalf("Acquire failed: %v", err)
	}

	// Simulate an external/admin action that overwrites the lock with a new revision.
	store.ForceOverwrite("admin-resource", []byte("admin"), ttl)

	// Heartbeat interval is ttl/3; cancellation should happen on the next renewal attempt.
	select {
	case <-workerCtx.Done():
		// ok
	case <-time.After(2 * ttl):
		t.Fatal("Expected worker context cancellation after admin preemption")
	}
}

// TEST 5: Watcher ctx cancellation + thundering herd mitigation
// Validates: Req 2 (ctx-respecting watch wait) and "no leaked watchers".
func TestRepository_After_WatchRespectsContext_AndAvoidsThunderingHerd(t *testing.T) {
	t.Log(">>> [5/5] Testing Watch Cancellation + Herd Mitigation (Expected to PASS) <<<")

	store := NewMockStore()
	ttl := 500 * time.Millisecond
	lm := repoAfter.NewLeaseManager(store, "holder", ttl)

	// Acquire and hold the lock so others must wait.
	_, holderToken, err := lm.AcquireAndHold(context.Background(), "herd-resource")
	if err != nil {
		t.Fatalf("Acquire failed: %v", err)
	}

	// 5A) ctx-canceled waiter must not leak watchers.
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Millisecond)
	defer cancel()

	beforeWatches := store.WatchCalls()
	beforePuts := store.PutIfAbsentCalls()

	waiter := repoAfter.NewLeaseManager(store, "waiter", ttl)
	_, _, err = waiter.AcquireAndHold(ctx, "herd-resource")
	if err == nil {
		t.Fatal("Expected AcquireAndHold to fail due to ctx deadline")
	}

	// Give the watcher cleanup goroutine time to remove itself.
	deadline := time.Now().Add(400 * time.Millisecond)
	for time.Now().Before(deadline) {
		if store.ActiveWatchers() == 0 {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	if store.ActiveWatchers() != 0 {
		t.Fatalf("Watcher leak: expected 0 active watchers, got %d", store.ActiveWatchers())
	}
	if store.WatchCalls() == beforeWatches {
		t.Fatalf("Expected Watch to be used while waiting")
	}
	// While blocked, AcquireAndHold should not poll PutIfAbsent repeatedly.
	if gotDelta := store.PutIfAbsentCalls() - beforePuts; gotDelta > 2 {
		t.Fatalf("Expected no polling; too many PutIfAbsent calls while locked: delta=%d", gotDelta)
	}

	// 5B) Herd mitigation: on release, only one waiter should wake and retry quickly.
	waiters := 20
	acquiredCh := make(chan int64, waiters)
	holdCh := make(chan struct{})

	for i := 0; i < waiters; i++ {
		go func(i int) {
			wctx, wcancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer wcancel()
			worch := repoAfter.NewLeaseManager(store, fmt.Sprintf("w-%d", i), ttl)
			_, tok, err := worch.AcquireAndHold(wctx, "herd-resource")
			if err != nil {
				return
			}
			acquiredCh <- tok
			<-holdCh
			_ = worch.Release(context.Background(), "herd-resource", tok)
		} (i)
	}

	// Wait until they are registered as watchers (best effort).
	deadline = time.Now().Add(600 * time.Millisecond)
	for time.Now().Before(deadline) {
		if store.ActiveWatchersForKey("herd-resource") >= waiters {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}

	putsBeforeRelease := store.PutIfAbsentCalls()
	_ = lm.Release(context.Background(), "herd-resource", holderToken) // free the lock

	// Since notifyWatchers wakes ALL waiters, validate that jitter spreads their
	// retries (i.e., we don't see a giant spike immediately after release).
	// Expect only a small number of immediate retries in the first few ms.
	time.Sleep(5 * time.Millisecond)
	putsEarly := store.PutIfAbsentCalls()
	if delta := putsEarly - putsBeforeRelease; delta > 5 {
		close(holdCh)
		t.Fatalf("Thundering herd suspected: too many immediate PutIfAbsent retries after release: delta=%d", delta)
	}

	// At least one waiter should acquire within a short window.
	select {
	case <-acquiredCh:
		// ok
	case <-time.After(250 * time.Millisecond):
		close(holdCh)
		t.Fatal("Expected a waiter to acquire after release")
	}

	close(holdCh)
}

// Graceful handover / cleanup: repeated acquire/release cycles should not leak watchers.
func TestRepository_After_RepeatedAcquireRelease_DoesNotLeakWatchers(t *testing.T) {
	store := NewMockStore()
	ttl := 150 * time.Millisecond
	lm := repoAfter.NewLeaseManager(store, "cycler", ttl)

	for i := 0; i < 30; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
		workerCtx, token, err := lm.AcquireAndHold(ctx, "cycle-resource")
		if err != nil {
			cancel()
			t.Fatalf("Acquire failed on iteration %d: %v", i, err)
		}
		// Should be live at acquisition.
		select {
		case <-workerCtx.Done():
			cancel()
			t.Fatalf("Unexpected cancellation on iteration %d", i)
		default:
		}

		if err := lm.Release(context.Background(), "cycle-resource", token); err != nil {
			cancel()
			t.Fatalf("Release failed on iteration %d: %v", i, err)
		}
		cancel()
	}

	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) {
		if store.ActiveWatchers() == 0 {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	if store.ActiveWatchers() != 0 {
		t.Fatalf("Expected 0 active watchers after cycles, got %d", store.ActiveWatchers())
	}
}