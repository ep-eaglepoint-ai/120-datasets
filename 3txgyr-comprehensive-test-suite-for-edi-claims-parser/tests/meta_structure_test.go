package tests

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMeta_TestFilesExist(t *testing.T) {
	dir := testFilesDir(t)

	requiredFiles := []string{
		"req01_segment_coverage_test.go",
		"req02_error_paths_test.go",
		"req03_concurrency_test.go",
		"req04_resource_leaks_test.go",
		"req05_claim_validation_test.go",
		"req07_isolation_test.go",
		"req08_performance_test.go",
		"req09_fuzz_test.go",
		"req10_compliance_doc_test.go",
		"mock_test.go",
		"test_helpers_test.go",
		"http_test_helper.go",
	}

	for _, f := range requiredFiles {
		t.Run(f, func(t *testing.T) {
			path := filepath.Join(dir, f)
			if _, err := os.Stat(path); os.IsNotExist(err) {
				t.Errorf("Missing required test file: %s", f)
			}
		})
	}
}

func TestMeta_AllFilesHavePackageDeclaration(t *testing.T) {
	dir := testFilesDir(t)
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("Failed to read directory: %v", err)
	}

	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".go") {
			t.Run(e.Name(), func(t *testing.T) {
				content := readTestFile(t, e.Name())
				if !strings.Contains(content, "package collaborate") {
					t.Errorf("File %s must have 'package collaborate'", e.Name())
				}
			})
		}
	}
}

func TestMeta_RequirementsSummary(t *testing.T) {
	t.Log("=== EDI CLAIMS PARSER TEST SUITE - REQUIREMENTS SUMMARY ===")
	t.Log("")
	t.Log("REQ1: 10 segment types (BHT, HI, CLM, DTP, NM1, LX, SV1, SV2, SBR, REF)")
	t.Log("REQ2: Error paths with errors.Is/As")
	t.Log("REQ3: 10+ goroutines, -race, MockLogger mutex")
	t.Log("REQ4: Goroutine/FD leak detection")
	t.Log("REQ5: Exact claim.Claim validation")
	t.Log("REQ6: Go 1.21+, standard library only")
	t.Log("REQ7: Shuffle stability, isolation")
	t.Log("REQ8: Benchmarks with ReportAllocs")
	t.Log("REQ9: 3+ fuzz tests")
	t.Log("REQ10: Compliance documentation")
	t.Log("")
	t.Log("=== END SUMMARY ===")
}
