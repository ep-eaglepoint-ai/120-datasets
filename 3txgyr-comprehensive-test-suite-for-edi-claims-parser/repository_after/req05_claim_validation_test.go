// REQ5: Tests must validate exact claim
package collaborate

import (
	"testing"

	claim "github.com/aci/backend/internal/core/services/claim"
)

func Test_MapSegments_FullClaim_AllFields_Validated(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("BHT", map[string]interface{}{"4": "20230115"}),
		seg("HI", map[string]interface{}{"1": "BE", "1-1": "24", "1-4": "1540.0"}),
		seg("CLM", map[string]interface{}{"1": "CLM-FULL", "2": "250.00", "5": "11", "5-2": "1"}),
		seg("DTP", map[string]interface{}{"1": "434", "3": "20230101-20230110"}),
		seg("NM1", map[string]interface{}{"1": "IL", "3": "DOE", "4": "JANE", "9": "M1"}),
		seg("SBR", map[string]interface{}{"1": "P"}),
		seg("NM1", map[string]interface{}{"1": "PR", "3": "Aetna", "9": "I1"}),
		seg("REF", map[string]interface{}{"1": "F8", "2": "ORIG-X"}),
		seg("LX", map[string]interface{}{"1": "1"}),
		seg("SV1", map[string]interface{}{"1-1": "99213", "1-2": "AH", "2": "100", "3": "HC", "4": "1"}),
		seg("LX", map[string]interface{}{"1": "2"}),
		seg("SV2", map[string]interface{}{"2-1": "97110", "3": "75", "4": "DA", "5": "2"}),
	}

	got := a.mapSingleClaimFromSegments(segments)

	want := claim.Claim{
		ClaimId:                "CLM-FULL",
		ClaimSubittionDate:     mustParseDate("20230115"),
		ServiceDateFrom:        mustParseDate("20230101"),
		ServiceDateTo:          mustParseDate("20230110"),
		TotalCharge:            mustDecimal("250.00"),
		ClaimFrequency:         "1",
		TypeOfService:          string(claim.PlaceOfServiceOnsite),
		PatientId:              "M1",
		PatientName:            "JANE DOE",
		PrimaryInsuranceName:   "Aetna",
		PrimaryInsuranceId:     "I1",
		OriginalClaimNumber:    "ORIG-X",
		ServiceLines: []claim.ServiceLine{
			{LineNumber: "1", CPTCode: "99213", Modifiers: []string{"AH"}, Code: "HC", Units: 1, Amount: mustDecimal("100")},
			{LineNumber: "2", CPTCode: "97110", Modifiers: nil, Code: "DA", Units: 2, Amount: mustDecimal("75")},
		},
	}

	assertClaimEqual(t, got, want)
}

func Test_MapSegments_PatientName_FirstAndLast_Validated(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("NM1", map[string]interface{}{"1": "IL", "3": "SMITH", "4": "JOHN", "9": "P123"}),
	}
	got := a.mapSingleClaimFromSegments(segments)

	if got.PatientId != "P123" {
		t.Errorf("PatientId: got %q want P123", got.PatientId)
	}
	if got.PatientName != "JOHN SMITH" {
		t.Errorf("PatientName: got %q want 'JOHN SMITH'", got.PatientName)
	}
}

func Test_MapSegments_InsuranceIds_PrimaryAndSecondary_Validated(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("SBR", map[string]interface{}{"1": "P"}),
		seg("NM1", map[string]interface{}{"1": "PR", "3": "Cigna", "9": "CIG001"}),
		seg("SBR", map[string]interface{}{"1": "S"}),
		seg("NM1", map[string]interface{}{"1": "PR", "3": "Medicare", "9": "MED002"}),
	}
	got := a.mapSingleClaimFromSegments(segments)

	if got.PrimaryInsuranceName != "Cigna" || got.PrimaryInsuranceId != "CIG001" {
		t.Errorf("Primary insurance: got %q/%q want Cigna/CIG001",
			got.PrimaryInsuranceName, got.PrimaryInsuranceId)
	}
	if got.SecondaryInsuranceName != "Medicare" || got.SecondaryInsuranceId != "MED002" {
		t.Errorf("Secondary insurance: got %q/%q want Medicare/MED002",
			got.SecondaryInsuranceName, got.SecondaryInsuranceId)
	}
}

func Test_MapSegments_ServiceLineAmounts_Validated(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("LX", map[string]interface{}{"1": "1"}),
		seg("SV1", map[string]interface{}{"1-1": "99213", "2": "125.50", "3": "HC", "4": "2"}),
		seg("LX", map[string]interface{}{"1": "2"}),
		seg("SV1", map[string]interface{}{"1-1": "99214", "2": "175.75", "3": "HC", "4": "3"}),
	}
	got := a.mapSingleClaimFromSegments(segments)

	if len(got.ServiceLines) != 2 {
		t.Fatalf("expected 2 service lines, got %d", len(got.ServiceLines))
	}
	if !got.ServiceLines[0].Amount.Equal(mustDecimal("125.50")) {
		t.Errorf("ServiceLine[0].Amount: got %v want 125.50", got.ServiceLines[0].Amount)
	}
	if got.ServiceLines[0].Units != 2 {
		t.Errorf("ServiceLine[0].Units: got %d want 2", got.ServiceLines[0].Units)
	}
	if !got.ServiceLines[1].Amount.Equal(mustDecimal("175.75")) {
		t.Errorf("ServiceLine[1].Amount: got %v want 175.75", got.ServiceLines[1].Amount)
	}
	if got.ServiceLines[1].Units != 3 {
		t.Errorf("ServiceLine[1].Units: got %d want 3", got.ServiceLines[1].Units)
	}
}

func Test_MapSegments_Dates_ServiceAndSubmission_Validated(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("BHT", map[string]interface{}{"4": "20230220"}),
		seg("DTP", map[string]interface{}{"1": "434", "3": "20230101-20230115"}),
	}
	got := a.mapSingleClaimFromSegments(segments)

	// REQ5: Exact date validation
	if !got.ClaimSubittionDate.Equal(mustParseDate("20230220")) {
		t.Errorf("ClaimSubittionDate: got %v want 2023-02-20", got.ClaimSubittionDate)
	}
	if !got.ServiceDateFrom.Equal(mustParseDate("20230101")) {
		t.Errorf("ServiceDateFrom: got %v want 2023-01-01", got.ServiceDateFrom)
	}
	if !got.ServiceDateTo.Equal(mustParseDate("20230115")) {
		t.Errorf("ServiceDateTo: got %v want 2023-01-15", got.ServiceDateTo)
	}
}

func Test_MapSegments_Modifiers_AllAllowed_Validated(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("LX", map[string]interface{}{"1": "1"}),
		seg("SV1", map[string]interface{}{
			"1-1": "99213",
			"1-2": "AH",
			"1-3": "AJ",
			"1-4": "HO",
			"1-5": "AF",
			"2":   "100",
			"3":   "HC",
			"4":   "1",
		}),
	}
	got := a.mapSingleClaimFromSegments(segments)

	if len(got.ServiceLines) != 1 {
		t.Fatalf("expected 1 service line, got %d", len(got.ServiceLines))
	}
	modifiers := got.ServiceLines[0].Modifiers
	expected := []string{"AH", "AJ", "HO", "AF"}
	if len(modifiers) != len(expected) {
		t.Fatalf("expected %d modifiers, got %d: %v", len(expected), len(modifiers), modifiers)
	}
	for i, exp := range expected {
		if modifiers[i] != exp {
			t.Errorf("Modifier[%d]: got %q want %q", i, modifiers[i], exp)
		}
	}
}

func Test_MapSegments_MultipleServiceLines_Validated(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("CLM", map[string]interface{}{"1": "MULTI-SL", "2": "500.00"}),
		seg("LX", map[string]interface{}{"1": "1"}),
		seg("SV1", map[string]interface{}{"1-1": "99213", "2": "100", "3": "HC", "4": "1"}),
		seg("LX", map[string]interface{}{"1": "2"}),
		seg("SV1", map[string]interface{}{"1-1": "99214", "2": "150", "3": "HC", "4": "2"}),
		seg("LX", map[string]interface{}{"1": "3"}),
		seg("SV2", map[string]interface{}{"2-1": "97110", "3": "250", "4": "UN", "5": "5"}),
	}
	got := a.mapSingleClaimFromSegments(segments)

	// REQ5: Validate all service lines
	if len(got.ServiceLines) != 3 {
		t.Fatalf("expected 3 service lines, got %d", len(got.ServiceLines))
	}

	if got.ServiceLines[0].LineNumber != "1" || got.ServiceLines[0].CPTCode != "99213" {
		t.Errorf("Line1: LineNumber=%q CPTCode=%q", got.ServiceLines[0].LineNumber, got.ServiceLines[0].CPTCode)
	}
	if got.ServiceLines[1].LineNumber != "2" || got.ServiceLines[1].CPTCode != "99214" {
		t.Errorf("Line2: LineNumber=%q CPTCode=%q", got.ServiceLines[1].LineNumber, got.ServiceLines[1].CPTCode)
	}
	if got.ServiceLines[2].LineNumber != "3" || got.ServiceLines[2].CPTCode != "97110" {
		t.Errorf("Line3: LineNumber=%q CPTCode=%q", got.ServiceLines[2].LineNumber, got.ServiceLines[2].CPTCode)
	}
}
