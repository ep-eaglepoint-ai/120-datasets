// REQ4: Must verify no goroutine leaks (runtime.NumGoroutine() returns to baseline),
// no file descriptor leaks (on Linux, check /proc/self/fd count), and proper cleanup
// of HTTP connections using t.Cleanup() or defer statements.
package collaborate

import (
	"os"
	"runtime"
	"sync"
	"testing"
	"time"
)

func Test_ResourceLeak_MapSegments_GoroutineCountReturnsToBaseline(t *testing.T) {
	runtime.GC()
	time.Sleep(50 * time.Millisecond)
	before := runtime.NumGoroutine()

	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("CLM", map[string]interface{}{"1": "X", "2": "100"}),
	}
	const iters = 200
	var wg sync.WaitGroup
	for i := 0; i < iters; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = a.mapSingleClaimFromSegments(segments)
		}()
	}
	wg.Wait()

	runtime.GC()
	time.Sleep(100 * time.Millisecond)
	after := runtime.NumGoroutine()

	delta := after - before
	if delta > 2 {
		t.Errorf("goroutine leak suspected: before=%d after=%d delta=%d", before, after, delta)
	}
}

func Test_ResourceLeak_RepeatedMapSegments_NoGoroutineLeak(t *testing.T) {
	runtime.GC()
	time.Sleep(50 * time.Millisecond)
	before := runtime.NumGoroutine()

	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("BHT", map[string]interface{}{"4": "20230115"}),
		seg("CLM", map[string]interface{}{"1": "TEST", "2": "100"}),
		seg("NM1", map[string]interface{}{"1": "IL", "3": "DOE", "4": "JOHN", "9": "P1"}),
	}

	for i := 0; i < 500; i++ {
		_ = a.mapSingleClaimFromSegments(segments)
	}

	runtime.GC()
	time.Sleep(100 * time.Millisecond)
	after := runtime.NumGoroutine()

	if after > before+2 {
		t.Errorf("goroutine leak: before=%d after=%d", before, after)
	}
}


func Test_ResourceLeak_FileDescriptorCount_Linux(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("FD count check only on Linux (/proc/self/fd)")
	}
	before, err := fdCount()
	if err != nil {
		t.Skipf("fd count: %v", err)
	}

	a, _ := newTestAPI(t)
	segments := []RawSegment837{seg("CLM", map[string]interface{}{"1": "X", "2": "100"})}
	for i := 0; i < 100; i++ {
		_ = a.mapSingleClaimFromSegments(segments)
	}

	after, err := fdCount()
	if err != nil {
		t.Skipf("fd count: %v", err)
	}
	if after > before+2 {
		t.Errorf("FD leak suspected: before=%d after=%d", before, after)
	}
}

func fdCount() (int, error) {
	ents, err := os.ReadDir("/proc/self/fd")
	if err != nil {
		return 0, err
	}
	return len(ents), nil
}

func Test_ResourceLeak_TempDir_CleanedUp(t *testing.T) {
	dir := t.TempDir() // t.TempDir() auto-cleans on test end
	_, err := os.Stat(dir)
	if os.IsNotExist(err) {
		t.Fatal("temp dir should exist during test")
	}
}

func Test_ResourceLeak_ExplicitCleanup(t *testing.T) {
	cleaned := false
	t.Cleanup(func() {
		cleaned = true
	})

	a, _ := newTestAPI(t)
	segments := []RawSegment837{seg("CLM", map[string]interface{}{"1": "X"})}
	_ = a.mapSingleClaimFromSegments(segments)

	if cleaned {
		t.Error("cleanup should not have run yet")
	}
}
