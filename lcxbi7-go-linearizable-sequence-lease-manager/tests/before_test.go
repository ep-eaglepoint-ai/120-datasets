//go:build before

package main

import (
	"context"
	"testing"
	"time"

	repoBefore "lcxbi7-go-linearizable-sequence-lease-manager/repository_before"
)

// TEST 1: Concurrency & Linearizability
func TestRepository_Before_Concurrency(t *testing.T) {
	t.Log(">>> [1/2] Testing Concurrency (Expected to FAIL with Safety Violations) <<<")

	SharedConcurrencyTest(t, func(id int, store *MockStore) (context.Context, int64, func(), error) {
		// We instantiate directly. 'store' remains nil, but the stub code doesn't use it.
		mgr := &repoBefore.LeaseManager{}

		// This returns immediately with (ctx, 0, nil)
		ctx, token, err := mgr.AcquireAndHold(context.Background(), "resource-1")

		release := func() {}

		return ctx, token, release, err
	})
}

// TEST 2: Network Partition / Zombie Prevention
// EXPECTED RESULT: FAIL (Timeout / Zombie Detected)
func TestRepository_Before_ZombiePartition(t *testing.T) {
	t.Log(">>> [2/2] Testing Zombie Prevention (Expected to FAIL) <<<")

	// 1. Setup
	mgr := &repoBefore.LeaseManager{}
	store := NewMockStore() // We create it just to simulate the environment, though unused by the stub

	// 2. Acquire Lock
	// In legacy code, this is just a pass-through
	ctx, _, err := mgr.AcquireAndHold(context.Background(), "critical-resource")
	if err != nil {
		t.Fatalf("Legacy acquire failed unexpectedly: %v", err)
	}

	// 3. Simulate Partition
	t.Log("Simulating network partition...")
	store.SetPartition(true)

	// 4. Expect Cancellation (Fail-Fast)
	// We wait 2 seconds. The legacy code will definitely NOT cancel the context.
	select {
	case <-ctx.Done():
		t.Error("Unexpected Success: Context canceled? (Legacy code doesn't support this)")
	case <-time.After(2 * time.Second):
		// This is the specific failure we are looking for to prove the need for refactoring
		t.Fatal("FAILURE VERIFIED: Zombie Detected. The worker context was NOT canceled during the partition.")
	}
}
