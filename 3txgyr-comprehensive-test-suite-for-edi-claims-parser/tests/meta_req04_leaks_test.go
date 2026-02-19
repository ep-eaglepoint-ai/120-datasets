package tests

import (
	"regexp"
	"strings"
	"testing"
)

func TestMeta_REQ4_GoroutineLeakTests(t *testing.T) {
	content := readTestFile(t, "req04_resource_leaks_test.go")

	if !strings.Contains(content, "runtime.NumGoroutine") {
		t.Error("REQ4: Must use runtime.NumGoroutine() to check goroutine leaks")
	}

	if !regexp.MustCompile(`before.*:=.*NumGoroutine|after.*:=.*NumGoroutine`).MatchString(content) {
		t.Error("REQ4: Must compare goroutine count before/after")
	}
}

func TestMeta_REQ4_FileDescriptorLeakTests(t *testing.T) {
	content := readTestFile(t, "req04_resource_leaks_test.go")

	if !strings.Contains(content, "/proc/self/fd") {
		t.Log("REQ4: Note - FD leak test using /proc/self/fd for Linux")
	}

	if !strings.Contains(content, "t.Cleanup") && !strings.Contains(content, "t.TempDir") {
		t.Log("REQ4: Consider using t.Cleanup() or t.TempDir() for cleanup")
	}
}

func TestMeta_REQ4_ResourceLeakTestCount(t *testing.T) {
	content := readTestFile(t, "req04_resource_leaks_test.go")

	leakTests := countMatches(content, `func Test_ResourceLeak_`)
	if leakTests < 2 {
		t.Errorf("REQ4: Need at least 2 resource leak tests, found %d", leakTests)
	}
}
