package tests

import (
	"regexp"
	"strings"
	"testing"
)

func TestMeta_REQ3_ConcurrencyTestsExist(t *testing.T) {
	content := readTestFile(t, "req03_concurrency_test.go")

	if !strings.Contains(content, "sync.WaitGroup") {
		t.Error("REQ3: Concurrency tests must use sync.WaitGroup")
	}

	if !regexp.MustCompile(`(?:const N = 1[0-9]|const N = [2-9]\d|N = 12|12 goroutines|10\+ )`).MatchString(content) {
		t.Error("REQ3: Must have tests with 10+ concurrent goroutines")
	}
}

func TestMeta_REQ3_MockLoggerMutex(t *testing.T) {
	content := readTestFile(t, "mock_test.go")

	if !strings.Contains(content, "sync.Mutex") {
		t.Error("REQ3: MockLogger must use sync.Mutex for goroutine safety")
	}

	if !strings.Contains(content, "m.mu.Lock()") {
		t.Error("REQ3: MockLogger.Error must lock mutex")
	}
}

func TestMeta_REQ3_RaceCompatible(t *testing.T) {
	content := readTestFile(t, "req03_concurrency_test.go")

	if !strings.Contains(content, "-race") {
		t.Log("REQ3: Note - tests should pass with -race flag")
	}

	concurrentTests := countMatches(content, `func Test_Concurrent_`)
	if concurrentTests < 3 {
		t.Errorf("REQ3: Need at least 3 concurrent tests, found %d", concurrentTests)
	}
}
