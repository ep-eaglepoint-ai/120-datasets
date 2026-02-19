//go:build after
// +build after

package load_test

import (
	"fmt"
	"go-proxy/repository_after/app"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

// Thread-Safe Mock Server to simulate concurrent load
type MockServer struct {
	mu          sync.RWMutex
	Alive       bool
	Address     string
	CallCount   int
}

func (m *MockServer) GetAddress() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.Address
}

func (m *MockServer) CheckIfServerIsCurrentlyAlive() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.Alive
}

func (m *MockServer) ServeTheRequest(rw http.ResponseWriter, req *http.Request) {
	m.mu.Lock()
	m.CallCount++
	m.mu.Unlock()
	// Simulate writing a response body to trigger the Sampling Buffer logic
	rw.Write([]byte("mock response body"))
}

func (m *MockServer) SetAlive(alive bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Alive = alive
}

// --- Test 1: Configuration & Atomic Integrity ---
func TestConfigurationManager_Singleton_And_Atomics(t *testing.T) {
	// 1. Singleton Check
	cm1 := app.GetConfigManager()
	cm2 := app.GetConfigManager()

	if cm1 != cm2 {
		t.Fatal("CRITICAL: ConfigurationManager is not a Singleton")
	}

	// 2. High-Concurrency Atomic Counter Check
	var wg sync.WaitGroup
	routineCount := 1000
	initialCount := cm1.GetGlobalCounter()

	for i := 0; i < routineCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			cm1.IncrementGlobalCounter()
		}()
	}
	wg.Wait()

	expected := initialCount + int64(routineCount)
	if actual := cm1.GetGlobalCounter(); actual != expected {
		t.Errorf("Atomic Counter Race Condition detected. Expected %d, got %d", expected, actual)
	}
}

// --- Test 2: Load Balancing & Fallback Logic ---
func TestLoadBalancer_RoundRobin_And_Fallbacks(t *testing.T) {
	s1 := &MockServer{Alive: true, Address: "s1"}
	s2 := &MockServer{Alive: false, Address: "s2"} // Starts dead
	s3 := &MockServer{Alive: true, Address: "s3"}

	servers := []app.ServerInterface{s1, s2, s3}
	lb := app.CreateNewLoadBalancerInstance("8080", servers)

	// 1. First Request -> Should get s1
	srv := lb.FindNextAvailableServerForRequest(false)
	if srv.GetAddress() != "s1" {
		t.Errorf("Expected s1, got %s", srv.GetAddress())
	}

	// 2. Second Request -> Should Skip s2 (dead) and get s3
	srv = lb.FindNextAvailableServerForRequest(false)
	if srv.GetAddress() != "s3" {
		t.Errorf("Expected s3 (skipping dead s2), got %s", srv.GetAddress())
	}

	// 3. Third Request -> Round Robin wraps to s1
	srv = lb.FindNextAvailableServerForRequest(false)
	if srv.GetAddress() != "s1" {
		t.Errorf("Expected s1 (wrap around), got %s", srv.GetAddress())
	}

	// 4. Edge Case: ALL Servers Dead
	s1.SetAlive(false)
	s3.SetAlive(false)
	// s2 is already false

	// Should return fallback (Index 0) and NOT infinite loop
	done := make(chan bool)
	go func() {
		srv = lb.FindNextAvailableServerForRequest(false)
		done <- true
	}()

	select {
	case <-done:
		if srv.GetAddress() != "s1" {
			t.Errorf("Fallback failed. Expected s1 (fallback), got %s", srv.GetAddress())
		}
	case <-time.After(1 * time.Second):
		t.Fatal("CRITICAL: Infinite loop detected when all servers are dead")
	}
}

// --- Test 3: Sticky Sessions & Memory Alignment ---
func TestStickySessions_And_Reassignment(t *testing.T) {
	s1 := &MockServer{Alive: true, Address: "10.0.0.1"}
	s2 := &MockServer{Alive: true, Address: "10.0.0.2"}
	lb := app.CreateNewLoadBalancerInstance("8080", []app.ServerInterface{s1, s2})

	docID := "contract_999"
	dirtyDocID := "  contract_999  " // Test Memory Alignment (TrimSpace)

	// 1. Assign Initial
	srvA := lb.FindServerWithExistingDocumentConnection(docID)

	// 2. Request with dirty string -> Should match srvA
	srvB := lb.FindServerWithExistingDocumentConnection(dirtyDocID)

	if srvA.GetAddress() != srvB.GetAddress() {
		t.Errorf("Memory Alignment Failed. 'doc' and '  doc  ' went to different servers: %s vs %s", srvA.GetAddress(), srvB.GetAddress())
	}

	// 3. Edge Case: Assigned Server Dies
	// Find which server mock was picked and kill it
	if srvA.GetAddress() == s1.Address {
		s1.SetAlive(false)
	} else {
		s2.SetAlive(false)
	}

	// 4. Re-request -> Should detect dead server and re-route
	srvC := lb.FindServerWithExistingDocumentConnection(docID)

	if srvC.GetAddress() == srvA.GetAddress() {
		t.Errorf("Sticky Session failed to drop dead server. Still returned %s", srvC.GetAddress())
	}
	if !srvC.CheckIfServerIsCurrentlyAlive() {
		t.Errorf("Re-routed request returned a dead server: %s", srvC.GetAddress())
	}
}

// --- Test 4: Concurrency & Shared Memory Safety (Critical) ---
func TestConcurrency_SamplingBuffer_RaceCondition(t *testing.T) {

	s1 := &MockServer{Alive: true, Address: "s1"}
	servers := []app.ServerInterface{s1}
	lb := app.CreateNewLoadBalancerInstance("8080", servers)

	var wg sync.WaitGroup
	workers := 50 // Simultaneous requests

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			// Create a request with a document ID to trigger map reads/writes
			url := fmt.Sprintf("/proxy?document_id=doc_%d", id%5) // Reuse some IDs to force contention
			req := httptest.NewRequest("GET", url, nil)
			rr := httptest.NewRecorder()

			lb.HandleProxyServing(rr, req)
		}(i)
	}

	wg.Wait()
}

// --- Test 5: Middleware Chain Verification ---
func TestMiddleware_Chain_Execution(t *testing.T) {
	// We create a server wrapper using the factory
	wrapper := app.CreateNewSimpleServerInstance("http://google.com", 1)

	// Check if it implements interface
	if wrapper.GetAddress() != "http://google.com" {
		t.Error("Wrapper failed to return correct address")
	}

	// Capture Pre-Counter
	preCount := app.GetConfigManager().GetGlobalCounter()

	// Execute Request
	req := httptest.NewRequest("GET", "/", nil)
	rr := httptest.NewRecorder()
	wrapper.ServeTheRequest(rr, req)

	// Check Post-Counter (Logging Middleware Side Effect)
	postCount := app.GetConfigManager().GetGlobalCounter()

	if postCount <= preCount {
		t.Error("Logging Middleware did not increment Global Counter")
	}
}

func TestPerformance_ConcurrencyBottleneck(t *testing.T) {
	slowBackend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer slowBackend.Close()

	// Refactored factory might return a wrapper, but fits the interface
	srv := app.CreateNewSimpleServerInstance(slowBackend.URL, 0)
	lb := app.CreateNewLoadBalancerInstance("8080", []app.ServerInterface{srv})

	start := time.Now()
	var wg sync.WaitGroup
	requests := 10

	for i := 0; i < requests; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req := httptest.NewRequest("GET", "/?document_id=123", nil)
			rr := httptest.NewRecorder()
			lb.HandleProxyServing(rr, req)
		}()
	}
	wg.Wait()
	duration := time.Since(start)

	t.Logf("Processed %d requests in %v", requests, duration)

	if duration > 500*time.Millisecond {
		t.Errorf("PERFORMANCE FAIL: Took %v (Threshold: 500ms). The architecture is not handling concurrency correctly.", duration)
	}
}