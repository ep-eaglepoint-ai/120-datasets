package tests

import (
	"strings"
	"testing"
)

func TestMeta_REQ5_ClaimValidationExists(t *testing.T) {
	content := readTestFile(t, "req05_claim_validation_test.go")

	claimFields := []string{
		"ClaimId", "PatientName", "PatientId",
		"PrimaryInsuranceName", "PrimaryInsuranceId",
		"ServiceLines", "TotalCharge",
	}

	for _, field := range claimFields {
		if !strings.Contains(content, field) {
			t.Errorf("REQ5: Missing validation for claim field: %s", field)
		}
	}
}

func TestMeta_REQ5_ServiceLineValidation(t *testing.T) {
	content := readTestFile(t, "req05_claim_validation_test.go")

	serviceLineFields := []string{"CPTCode", "Amount", "Units", "Modifiers"}
	for _, field := range serviceLineFields {
		if !strings.Contains(content, field) {
			t.Errorf("REQ5: Missing service line field validation: %s", field)
		}
	}
}

func TestMeta_REQ5_AssertClaimEqual(t *testing.T) {
	content := readAllTestFiles(t)

	if !strings.Contains(content, "assertClaimEqual") {
		t.Log("REQ5: Consider using assertClaimEqual helper for comprehensive validation")
	}
}
