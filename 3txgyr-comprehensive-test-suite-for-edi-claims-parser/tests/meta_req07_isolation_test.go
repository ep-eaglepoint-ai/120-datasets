package tests

import (
	"regexp"
	"strings"
	"testing"
)

func TestMeta_REQ7_IsolationTestsExist(t *testing.T) {
	content := readTestFile(t, "req07_isolation_test.go")

	if !strings.Contains(content, "Test_Isolation") {
		t.Error("REQ7: Must have isolation tests")
	}

	if !strings.Contains(content, "t.TempDir()") {
		t.Error("REQ7: Should use t.TempDir() for isolated temp directories")
	}
}

func TestMeta_REQ7_NoGlobalState(t *testing.T) {
	content := readTestFile(t, "req07_isolation_test.go")

	if !regexp.MustCompile(`NoGlobalState|GlobalState|shared state`).MatchString(content) {
		t.Log("REQ7: Consider adding explicit no-global-state tests")
	}
}

func TestMeta_REQ7_IndependentMockServers(t *testing.T) {
	content := readTestFile(t, "http_test_helper.go")

	if !strings.Contains(content, "sync.Mutex") {
		t.Log("REQ7: HTTP test helper should use mutex for server isolation")
	}

	if !strings.Contains(content, "t.Cleanup") {
		t.Error("REQ7: HTTP test helper must use t.Cleanup for server cleanup")
	}
}
