package tests

import (
	"strings"
	"testing"
)

func TestMeta_REQ10_DescriptiveTestNames(t *testing.T) {
	content := readTestFile(t, "req01_segment_coverage_test.go")

	goodNames := []string{
		"Test_BHT_Segment_ValidSubmissionDate_SetsClaimDate",
		"Test_CLM_Segment_SetsClaimIdAndTotalCharge",
		"Test_DTP_434_DateRange_SetsFromAndToDates",
	}

	found := 0
	for _, name := range goodNames {
		if strings.Contains(content, name) {
			found++
		}
	}

	if found < 2 {
		t.Errorf("REQ10: Test names should follow pattern Test_<Segment>_<Condition>_<Behavior>")
	}
}

func TestMeta_REQ10_BusinessRuleComments(t *testing.T) {
	content := readTestFile(t, "req10_compliance_doc_test.go")

	patterns := []string{
		"SEGMENT:",
		"BUSINESS RULES",
		"Requirement Traceability",
	}

	found := 0
	for _, p := range patterns {
		if strings.Contains(strings.ToUpper(content), strings.ToUpper(p)) {
			found++
		}
	}

	if found == 0 {
		t.Error("REQ10: Missing centralized business rule documentation in compliance tests")
	}
}

func TestMeta_REQ10_ComplianceDocumentation(t *testing.T) {
	content := readTestFile(t, "req10_compliance_doc_test.go")

	if !strings.Contains(content, "SOC 2") && !strings.Contains(content, "compliance") {
		t.Error("REQ10: Must include compliance documentation for SOC 2 audit")
	}

	if !strings.Contains(content, "REQ1") || !strings.Contains(content, "REQ10") {
		t.Log("REQ10: Consider adding requirement traceability documentation")
	}
}
