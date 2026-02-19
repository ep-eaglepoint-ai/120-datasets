// REQ7: Tests must pass with -shuffle=on -count=10 proving no shared state between tests.
// Each test uses isolated temp directories and independent mock servers. No cross-test contamination.
// Meta tests for shuffle stability are in meta_test.go
package collaborate

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func Test_Isolation_TempDir_Independent(t *testing.T) {
	dir1 := t.TempDir()
	dir2 := t.TempDir()

	if dir1 == dir2 {
		t.Error("temp directories should be independent")
	}

	testFile := filepath.Join(dir1, "test.txt")
	if err := os.WriteFile(testFile, []byte("test"), 0644); err != nil {
		t.Fatalf("write: %v", err)
	}

	otherFile := filepath.Join(dir2, "test.txt")
	if _, err := os.Stat(otherFile); !os.IsNotExist(err) {
		t.Error("file should not exist in other temp dir")
	}
}

func Test_Isolation_NoGlobalState_A(t *testing.T) {
	a, log := newTestAPI(t)
	segments := []RawSegment837{
		seg("CLM", map[string]interface{}{"1": "ISOLATION-A", "2": "100"}),
	}
	got := a.mapSingleClaimFromSegments(segments)

	if got.ClaimId != "ISOLATION-A" {
		t.Errorf("ClaimId: got %q", got.ClaimId)
	}
	for _, c := range log.Calls {
		if strings.Contains(c.Msg, "ISOLATION-B") {
			t.Error("log contains entries from other test")
		}
	}
}

func Test_Isolation_NoGlobalState_B(t *testing.T) {
	a, log := newTestAPI(t)
	segments := []RawSegment837{
		seg("CLM", map[string]interface{}{"1": "ISOLATION-B", "2": "200"}),
	}
	got := a.mapSingleClaimFromSegments(segments)

	if got.ClaimId != "ISOLATION-B" {
		t.Errorf("ClaimId: got %q", got.ClaimId)
	}
	for _, c := range log.Calls {
		if strings.Contains(c.Msg, "ISOLATION-A") {
			t.Error("log contains entries from other test")
		}
	}
}
