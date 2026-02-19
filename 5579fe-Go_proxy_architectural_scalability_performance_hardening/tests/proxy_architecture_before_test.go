//go:build before
// +build before

package load_test

import (
	"go-proxy/repository_before/app"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func resetGlobalState() {
	app.GlobalMutex.Lock()
	app.GlobalCounter = 0
	app.MagicNumber1 = 1
	app.MagicNumber2 = 0
	app.GlobalMutex.Unlock()
}

func spawnTestServer(isHealthy bool) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The legacy code checks "/health" explicitly
		if r.URL.Path == "/health" {
			if isHealthy {
				w.WriteHeader(http.StatusOK)
			} else {
				w.WriteHeader(http.StatusInternalServerError)
			}
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("proxied content"))
	}))
}

func TestLegacyGlobalCounter(t *testing.T) {
	resetGlobalState()

	backend := spawnTestServer(true)
	defer backend.Close()

	srv := app.CreateNewSimpleServerInstance(backend.URL, 0)

	req := httptest.NewRequest("GET", "/", nil)
	rr := httptest.NewRecorder()

	srv.ServeTheRequest(rr, req)

	app.GlobalMutex.Lock()
	val := app.GlobalCounter
	app.GlobalMutex.Unlock()

	if val != 1 {
		t.Errorf("Expected globalCounter to be 1, got %d", val)
	}
}

func TestLegacyHealthCheck(t *testing.T) {
	goodBackend := spawnTestServer(true)
	defer goodBackend.Close()

	srvGood := app.CreateNewSimpleServerInstance(goodBackend.URL, 0)
	if !srvGood.CheckIfServerIsCurrentlyAlive() {
		t.Error("Expected healthy server to be reported as alive")
	}

	badBackend := spawnTestServer(false)
	defer badBackend.Close()

	srvBad := app.CreateNewSimpleServerInstance(badBackend.URL, 1)
	if srvBad.CheckIfServerIsCurrentlyAlive() {
		t.Error("Expected unhealthy server to be reported as dead")
	}
}

func TestLegacyRoundRobinHTTP(t *testing.T) {
	resetGlobalState()

	b1 := spawnTestServer(true)
	defer b1.Close()
	b2 := spawnTestServer(true)
	defer b2.Close()

	s1 := app.CreateNewSimpleServerInstance(b1.URL, 0)
	s2 := app.CreateNewSimpleServerInstance(b2.URL, 1)

	lb := app.CreateNewLoadBalancerInstance("8080", []app.ServerInterface{s1, s2})

	selected1 := lb.FindNextAvailableServerForRequest(false)

	selected2 := lb.FindNextAvailableServerForRequest(false)

	if selected1.GetAddress() == selected2.GetAddress() {
		t.Errorf("Round robin failed. Selected same server twice: %s", selected1.GetAddress())
	}
}

func TestLegacyStickySessions(t *testing.T) {
	resetGlobalState()

	b1 := spawnTestServer(true)
	defer b1.Close()

	s1 := app.CreateNewSimpleServerInstance(b1.URL, 0)
	lb := app.CreateNewLoadBalancerInstance("8080", []app.ServerInterface{s1})

	docID := "doc_legacy_1"

	// legacy code creates a WebSocket connection object inside findServerWithExistingDocumentConnection
	serverFirst := lb.FindServerWithExistingDocumentConnection(docID)

	// Check internal map manually to verify state
	lb.SecondaryMutex.Lock()
	conn, exists := lb.DocumentIdToWebSocketConnectionMapping[docID]
	lb.SecondaryMutex.Unlock()

	if !exists || conn == nil {
		t.Fatal("Failed to create websocket mapping in legacy code")
	}

	// Call again - should return same server (though we only have 1 server here,
	serverSecond := lb.FindServerWithExistingDocumentConnection(docID)

	if serverFirst.GetAddress() != serverSecond.GetAddress() {
		t.Error("Sticky session returned different server address")
	}
}

func TestLegacyWebSocketRoundRobin(t *testing.T) {
	resetGlobalState()

	b1 := spawnTestServer(true)
	defer b1.Close()
	b2 := spawnTestServer(true)
	defer b2.Close()

	s1 := app.CreateNewSimpleServerInstance(b1.URL, 0)
	s2 := app.CreateNewSimpleServerInstance(b2.URL, 1)

	lb := app.CreateNewLoadBalancerInstance("8081", []app.ServerInterface{s1, s2})

	// Simulate WS request
	_ = lb.FindNextAvailableServerForRequest(true)

	lb.InternalMutex.Lock()
	counter := lb.RoundRobinCounterForWebSocketRequests
	lb.InternalMutex.Unlock()

	// Check if magicNumber1 was applied
	if counter != 1 {
		t.Errorf("Expected WebSocket counter to increment by magicNumber1 (1), got %d", counter)
	}
}

func TestPerformance_ConcurrencyBottleneck(t *testing.T) {
	// 1. Reset Global State (Legacy specific)
	resetGlobalState()

	// 2. Create a backend that simulates work (Sleeps 100ms)
	slowBackend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer slowBackend.Close()

	// 3. Initialize Load Balancer
	srv := app.CreateNewSimpleServerInstance(slowBackend.URL, 0)
	lb := app.CreateNewLoadBalancerInstance("8080", []app.ServerInterface{srv})

	// 4. Run 10 requests concurrently
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

	// We set the bar at 500ms.
	t.Logf("Processed %d requests in %v", requests, duration)

	if duration > 500*time.Millisecond {
		t.Errorf("PERFORMANCE FAIL: Took %v (Threshold: 500ms). The implementation is processing requests sequentially due to Global Locking.", duration)
	}
}
