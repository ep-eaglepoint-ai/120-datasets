package tests

import (
	"strings"
	"testing"
)

func TestMeta_REQ1_AllSegmentTypesHaveTests(t *testing.T) {
	content := readTestFile(t, "req01_segment_coverage_test.go")

	segments := []string{"BHT", "HI", "CLM", "DTP", "NM1", "LX", "SV1", "SV2", "SBR", "REF"}
	for _, seg := range segments {
		t.Run(seg, func(t *testing.T) {
			pattern := `func Test_` + seg + `_`
			if !strings.Contains(content, pattern) {
				t.Errorf("REQ1: Missing tests for segment %s (expected pattern: %s)", seg, pattern)
			}
		})
	}
}

func TestMeta_REQ1_TableDrivenTestsExist(t *testing.T) {
	content := readTestFile(t, "req01_segment_coverage_test.go")

	tablePatterns := []string{
		`tests := \[\]struct`,
		`for _, tt := range`,
		`t\.Run\(`,
	}

	for _, pattern := range tablePatterns {
		if countMatches(content, pattern) < 3 {
			t.Errorf("REQ1: Need more table-driven tests (pattern: %s)", pattern)
		}
	}
}

func TestMeta_REQ1_SegmentTestCount(t *testing.T) {
	content := readTestFile(t, "req01_segment_coverage_test.go")

	// This is a guardrail (not an exact quota): REQ1 requires coverage + edge cases,
	// but the precise number of tests can legitimately vary as the suite evolves.
	// We still enforce a reasonable floor so the suite can’t regress to “one test per segment”.
	testCount := countMatches(content, `func Test_[A-Z]+_`)
	const minReasonable = 20
	if testCount < minReasonable {
		t.Errorf("REQ1: Expected at least %d segment tests (guardrail), found %d", minReasonable, testCount)
	}
	t.Logf("REQ1: Found %d segment tests (min guardrail=%d)", testCount, minReasonable)
}
