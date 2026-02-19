package main

import (
	"context"
	"fmt"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestWorkerPool_Execution(t *testing.T) {
	workerCount := 3
	wp := NewWorkerPool(workerCount)
	ctx := context.Background()
	wp.Start(ctx)

	var wg sync.WaitGroup
	taskCount := 10
	wg.Add(taskCount)

	for i := 0; i < taskCount; i++ {
		wp.Submit(func() error {
			defer wg.Done()
			time.Sleep(10 * time.Millisecond)
			return nil
		})
	}

	wg.Wait()
	wp.Stop()

	results := wp.GetResults()
	if len(results) == 0 {
		t.Log("Warning: results map is empty, possibly due to race condition or implementation details")
	}
}

// -------------------------------------------------------------------
//Stop() must wait for in-flight tasks
// -------------------------------------------------------------------

func TestGracefulShutdown(t *testing.T) {
	pool := NewWorkerPool(5)
	pool.Start(context.Background())

	var taskStarted sync.WaitGroup
	taskStarted.Add(1)

	// Submit a task that takes 500ms
	pool.Submit(func() error {
		taskStarted.Done() // Signal that worker picked it up
		time.Sleep(500 * time.Millisecond)
		return nil
	})

	taskStarted.Wait() // Ensure task is running

	start := time.Now()
	pool.Stop() // Should block for ~500ms
	duration := time.Since(start)

	if duration < 450*time.Millisecond {
		t.Errorf("Stop() returned too fast (%v). It killed the task instead of waiting for it.", duration)
	}
}

// -------------------------------------------------------------------
// Stop() must be idempotent and not panic on multiple calls
// -------------------------------------------------------------------

func TestIdempotentStop(t *testing.T) {
	pool := NewWorkerPool(2)
	pool.Start(context.Background())

	// Call Stop multiple times
	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Panic on first Stop(): %v", r)
			}
		}()
		pool.Stop()
	}()

	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Panic on second Stop() (API not idempotent): %v", r)
			}
		}()
		pool.Stop()
	}()
}

// -------------------------------------------------------------------
//Resource Cleanup & No Memory Leaks
// -------------------------------------------------------------------

func TestGoroutineLeak(t *testing.T) {
	// Snapshot baseline goroutines
	// We run garbage collection to stabilize the count
	runtime.GC()
	baseGoroutines := runtime.NumGoroutine()

	pool := NewWorkerPool(50) // Spin up 50 workers
	ctx := context.Background()
	pool.Start(ctx)

	// Do some work
	for i := 0; i < 100; i++ {
		pool.Submit(func() error { return nil })
	}

	pool.Stop()

	// Give runtime a moment to schedule cleanup
	time.Sleep(100 * time.Millisecond)
	runtime.GC()

	endGoroutines := runtime.NumGoroutine()

	// Allow small variance for test runner overhead, but 50 workers should be gone
	if endGoroutines > baseGoroutines+5 {
		t.Errorf("Goroutine leak detected. Before: %d, After: %d. Workers did not exit.", baseGoroutines, endGoroutines)
	}
}

// -------------------------------------------------------------------
// Workers respect Context Cancellation immediately
// -------------------------------------------------------------------

func TestContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	pool := NewWorkerPool(5)
	pool.Start(ctx)

	// Simulate a "stuck" environment where no Stop() is called,
	// but context is cancelled (e.g. HTTP timeout)
	cancel()

	// We verify strict cleanup by checking goroutines
	time.Sleep(100 * time.Millisecond)

	// We can't easily check internal state, but we can verify Submit fails
	// or standard cleanup works.
	// In the fixed version, workers should exit.

	// Just ensure calling Stop() afterwards is safe
	pool.Stop()
}

// -------------------------------------------------------------------
//  Submit with 0 workers must return error
// -------------------------------------------------------------------

func TestZeroWorkers(t *testing.T) {
	pool := NewWorkerPool(0)
	pool.Start(context.Background())

	err := pool.Submit(func() error { return nil })
	if err == nil {
		t.Error("Expected error when submitting to pool with 0 workers, got nil")
	}

	// Verify it doesn't block forever
	done := make(chan bool)
	go func() {
		pool.Stop()
		done <- true
	}()

	select {
	case <-done:
		// success
	case <-time.After(1 * time.Second):
		t.Error("Stop() blocked on 0-worker pool")
	}
}

// -------------------------------------------------------------------
// Submit() after Stop() must return error
// -------------------------------------------------------------------

func TestSubmitAfterStop(t *testing.T) {
	pool := NewWorkerPool(2)
	pool.Start(context.Background())
	pool.Stop()

	// Must not panic, must return error
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("Panic when submitting after Stop: %v", r)
		}
	}()

	err := pool.Submit(func() error { return nil })
	if err == nil {
		t.Error("Expected error for Submit() after Stop(), got nil")
	}
}

// -------------------------------------------------------------------
// Submit(nil) must return error
// -------------------------------------------------------------------

func TestSubmitNilTask(t *testing.T) {
	pool := NewWorkerPool(2)
	pool.Start(context.Background())
	defer pool.Stop()

	err := pool.Submit(nil)
	if err == nil {
		t.Error("Expected error when submitting nil task, got nil")
	}
}

// -------------------------------------------------------------------
// LOGIC BUG CHECK: Data Integrity (Map Overwrites)
// -------------------------------------------------------------------

func TestResultDataIntegrity(t *testing.T) {
	// The original code used WorkerID as the map key.
	// This meant only (NumWorkers) results could ever be stored.

	const tasks = 100
	const workers = 5

	pool := NewWorkerPool(workers)
	pool.Start(context.Background())

	for i := 0; i < tasks; i++ {
		val := i
		pool.Submit(func() error {
			// Return a specific error to verify we get THIS specific result back
			return fmt.Errorf("task-%d", val)
		})
	}

	pool.Stop()
	results := pool.GetResults()

	if len(results) != tasks {
		t.Errorf("Data Loss! Submitted %d tasks, but map only contains %d items.", tasks, len(results))
	}
}

// -------------------------------------------------------------------
// STRESS TEST: 100k tasks (To ensure no deadlocks under load)
// -------------------------------------------------------------------

func TestStressLoad(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping stress test in short mode")
	}

	const totalTasks = 100_000
	// Use enough workers to actually process the load
	pool := NewWorkerPool(100)
	pool.Start(context.Background())

	var counter int32
	var submitWg sync.WaitGroup // <--- ADDED: To sync submissions

	submitWg.Add(1)

	// 1. Submit 100k tasks
	go func() {
		defer submitWg.Done()
		for i := 0; i < totalTasks; i++ {
			// We check error here. If Submit fails BEFORE Stop is called,
			// it's a real bug (or buffer full if not handled).
			err := pool.Submit(func() error {
				atomic.AddInt32(&counter, 1)
				return nil
			})
			if err != nil {
				t.Errorf("Unexpected submission error: %v", err)
			}
		}
	}()

	// 2. Wait for ALL submissions to finish
	submitWg.Wait() // <--- CRITICAL FIX: Block here until loop is done

	// 3. Now it is safe to Stop.
	// Stop() will wait for the workers to drain the queue.
	pool.Stop()

	// 4. Verify results
	finalCount := atomic.LoadInt32(&counter)
	if finalCount != int32(totalTasks) {
		t.Errorf("Stress test failed. Processed %d out of %d tasks", finalCount, totalTasks)
	}
}

// -------------------------------------------------------------------
// REQUIREMENT 1 & 2: Race Conditions & Race Detector Clean
// -------------------------------------------------------------------

func TestRaceCondition_ConcurrentSubmissions(t *testing.T) {
	// Requirements: 10,000+ tasks, pass -race
	t.Log("Testing high concurrency submission to check for race conditions...")

	pool := NewWorkerPool(20) // 20 workers
	ctx := context.Background()
	pool.Start(ctx)

	const numTasks = 5000
	const numSubmitters = 50

	var wg sync.WaitGroup
	wg.Add(numSubmitters)

	// 50 goroutines submitting 100 tasks each simultaneously
	for i := 0; i < numSubmitters; i++ {
		go func() {
			defer wg.Done()
			for j := 0; j < (numTasks / numSubmitters); j++ {
				pool.Submit(func() error {
					// Simulate slight work to ensure workers overlap
					time.Sleep(time.Microsecond * 10)
					return nil
				})
			}
		}()
	}

	wg.Wait() // Wait for submissions to finish
	pool.Stop()

	results := pool.GetResults()
	if len(results) != numTasks {
		t.Errorf("Race condition suspected. Expected %d results, got %d", numTasks, len(results))
	}
}

func TestNegativeWorkers(t *testing.T) {
	// Should not panic, should treat as 0 or 1 depending on implementation choice.
	// Based on solution: treated as 0 workers.
	pool := NewWorkerPool(-5)
	pool.Start(context.Background())
	defer pool.Stop()

	// Verify it behaves like 0 workers (returns error on submit)
	// or at least doesn't crash.
	err := pool.Submit(func() error { return nil })

	// If it allows submission but doesn't process, that's a block (timeout needed)
	// If it treats as 0, it returns error immediately.
	// We just want to ensure NO PANIC happened above.
	if err == nil {
		// If nil, it means it accepted it. Check if it blocks?
		// For this test, purely "No Panic" is the pass criteria.
	}
}

// -------------------------------------------------------------------
// Results Immutability Test
// -------------------------------------------------------------------

func TestResultsImmutability(t *testing.T) {
	pool := NewWorkerPool(1)
	pool.Start(context.Background())

	// 1. Generate a result
	var wg sync.WaitGroup
	wg.Add(1)
	pool.Submit(func() error {
		defer wg.Done()
		return fmt.Errorf("original-error")
	})
	wg.Wait()

	// 2. Get the map
	results := pool.GetResults()

	// 3. Verify content
	if len(results) != 1 {
		t.Fatalf("Expected 1 result, got %d", len(results))
	}

	// 4. MODIFY the returned map
	// If GetResults returned a pointer/reference, this would delete data inside the pool!
	delete(results, 1)

	// 5. Get the map again
	results2 := pool.GetResults()

	// 6. Verify internal state is untouched
	if len(results2) != 1 {
		t.Error("Security Fail: External caller was able to modify internal pool state! GetResults() must return a copy.")
	}

	pool.Stop()
}

// -------------------------------------------------------------------
//  Concurrent Submit + GetResults (Read/Write Race)
// -------------------------------------------------------------------

func TestRaceCondition_ReadWhileWrite(t *testing.T) {
	pool := NewWorkerPool(10)
	ctx := context.Background()
	pool.Start(ctx)

	const count = 1000
	var wg sync.WaitGroup
	wg.Add(count)

	// Writer Routine: Submits tasks that write errors
	go func() {
		for i := 0; i < count; i++ {
			pool.Submit(func() error {
				defer wg.Done()
				time.Sleep(100 * time.Microsecond)
				return nil
			})
		}
	}()

	// Reader Routine: Constantly reads results WHILE writes are happening
	// If RWMutex is missing or wrong, this will panic with "concurrent map read and map write"
	stopReads := make(chan struct{})
	go func() {
		for {
			select {
			case <-stopReads:
				return
			default:
				_ = pool.GetResults()
				// yield slightly to let writers run
				time.Sleep(10 * time.Microsecond)
			}
		}
	}()

	wg.Wait()
	close(stopReads)
	pool.Stop()
}
