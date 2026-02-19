package tests

import (
	"strings"
	"testing"
)

func TestMeta_REQ8_BenchmarksExist(t *testing.T) {
	content := readTestFile(t, "req08_performance_test.go")

	benchmarks := countMatches(content, `func Benchmark_`)
	if benchmarks < 3 {
		t.Errorf("REQ8: Need at least 3 benchmarks, found %d", benchmarks)
	}
}

func TestMeta_REQ8_ReportAllocsUsed(t *testing.T) {
	content := readTestFile(t, "req08_performance_test.go")

	if !strings.Contains(content, "b.ReportAllocs()") {
		t.Error("REQ8: Benchmarks must use b.ReportAllocs() for memory tracking")
	}

	count := countMatches(content, `b\.ReportAllocs\(\)`)
	if count < 3 {
		t.Errorf("REQ8: Each benchmark should call ReportAllocs(), found %d calls", count)
	}
}

func TestMeta_REQ8_ParallelBenchmark(t *testing.T) {
	content := readTestFile(t, "req08_performance_test.go")

	if !strings.Contains(content, "b.RunParallel") {
		t.Log("REQ8: Consider adding parallel benchmark with b.RunParallel")
	}
}
