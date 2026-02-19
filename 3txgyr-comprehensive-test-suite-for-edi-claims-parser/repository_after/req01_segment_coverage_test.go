package collaborate

import (
	"testing"
	"time"

	claim "github.com/aci/backend/internal/core/services/claim"
	"github.com/shopspring/decimal"
)

func Test_BHT_Segment_ValidSubmissionDate_SetsClaimDate(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("BHT", map[string]interface{}{"4": "20230115"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	want := claim.Claim{ClaimSubittionDate: mustParseDate("20230115")}
	if !got.ClaimSubittionDate.Equal(want.ClaimSubittionDate) {
		t.Errorf("ClaimSubittionDate: got %v want %v", got.ClaimSubittionDate, want.ClaimSubittionDate)
	}
}

func Test_BHT_Segment_EmptyDate_ParsesAsZeroTime(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{seg("BHT", map[string]interface{}{"4": ""})}
	got := a.mapSingleClaimFromSegments(segments)
	var z time.Time
	if !got.ClaimSubittionDate.Equal(z) {
		t.Errorf("expected zero time, got %v", got.ClaimSubittionDate)
	}
}

func Test_BHT_Segment_InvalidDateFormat_ParsesAsZeroTime(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{seg("BHT", map[string]interface{}{"4": "2023-01-15"})}
	got := a.mapSingleClaimFromSegments(segments)
	var z time.Time
	if !got.ClaimSubittionDate.Equal(z) {
		t.Errorf("expected zero time for invalid format, got %v", got.ClaimSubittionDate)
	}
}

func Test_BHT_Segment_TableDriven(t *testing.T) {
	a, _ := newTestAPI(t)
	tests := []struct {
		name     string
		field4   string
		wantZero bool
	}{
		{"Valid_Date_20230115", "20230115", false},
		{"Empty_String", "", true},
		{"Invalid_Format_BadChars", "bad", true},
		{"Invalid_Format_Hyphenated", "2023-01-15", true},
		{"Invalid_Format_Slashes", "01/15/2023", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			segments := []RawSegment837{seg("BHT", map[string]interface{}{"4": tt.field4})}
			got := a.mapSingleClaimFromSegments(segments)
			if tt.wantZero {
				var z time.Time
				if !got.ClaimSubittionDate.Equal(z) {
					t.Errorf("want zero time, got %v", got.ClaimSubittionDate)
				}
				return
			}
			wantT := mustParseDate(tt.field4)
			if !got.ClaimSubittionDate.Equal(wantT) {
				t.Errorf("got %v want %v", got.ClaimSubittionDate, wantT)
			}
		})
	}
}

func Test_HI_Segment_BE_PlaceOfService_1080_SetsOffsite(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("HI", map[string]interface{}{"1": "BE", "1-1": "24", "1-4": "1080.0"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	want := string(claim.PlaceOfServiceOffSite)
	if got.TypeOfService != want {
		t.Errorf("TypeOfService: got %q want %q", got.TypeOfService, want)
	}
}

func Test_HI_Segment_BE_PlaceOfService_1540_SetsOnsite(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("HI", map[string]interface{}{"1": "BE", "2-2": "24", "2-4": "1540.0"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	want := string(claim.PlaceOfServiceOnsite)
	if got.TypeOfService != want {
		t.Errorf("TypeOfService: got %q want %q", got.TypeOfService, want)
	}
}

func Test_HI_Segment_NonBE_Ignored(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("HI", map[string]interface{}{"1": "BR", "1-1": "24", "1-4": "1080.0"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.TypeOfService != "" {
		t.Errorf("expected TypeOfService empty for non-BE, got %q", got.TypeOfService)
	}
}

func Test_HI_Segment_BE_No24Qualifier_NoChange(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("HI", map[string]interface{}{"1": "BE", "1-1": "25", "1-4": "1080.0"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.TypeOfService != "" {
		t.Errorf("expected TypeOfService empty when 24 qualifier missing, got %q", got.TypeOfService)
	}
}

func Test_HI_Segment_TableDriven(t *testing.T) {
	tests := []struct {
		name     string
		fields   map[string]interface{}
		wantType string
	}{
		{"BE_1080_Offsite", map[string]interface{}{"1": "BE", "1-1": "24", "1-4": "1080.0"}, "offsite"},
		{"BE_1540_Onsite", map[string]interface{}{"1": "BE", "1-1": "24", "1-4": "1540.0"}, "onsite"},
		{"Non_BE_Ignored", map[string]interface{}{"1": "BF", "1-1": "24", "1-4": "1080.0"}, ""},
		{"BE_No_Qualifier_Empty", map[string]interface{}{"1": "BE", "1-1": "99", "1-4": "1080.0"}, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a, _ := newTestAPI(t)
			segments := []RawSegment837{seg("HI", tt.fields)}
			got := a.mapSingleClaimFromSegments(segments)
			if got.TypeOfService != tt.wantType {
				t.Errorf("TypeOfService: got %q want %q", got.TypeOfService, tt.wantType)
			}
		})
	}
}

func Test_CLM_Segment_SetsClaimIdAndTotalCharge(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("CLM", map[string]interface{}{"1": "CLM-001", "2": "150.99"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.ClaimId != "CLM-001" {
		t.Errorf("ClaimId: got %q want CLM-001", got.ClaimId)
	}
	if !got.TotalCharge.Equal(mustDecimal("150.99")) {
		t.Errorf("TotalCharge: got %v", got.TotalCharge)
	}
}

func Test_CLM_Segment_ClaimFrequency_AndPlaceOfService_Pos11_Onsite(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("CLM", map[string]interface{}{"1": "X", "5": "11", "5-2": "1"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.ClaimFrequency != "1" {
		t.Errorf("ClaimFrequency: got %q want 1", got.ClaimFrequency)
	}
	if got.TypeOfService != string(claim.PlaceOfServiceOnsite) {
		t.Errorf("TypeOfService: got %q want onsite", got.TypeOfService)
	}
}

func Test_CLM_Segment_PlaceOfService_Non11_SetsOffsite(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("CLM", map[string]interface{}{"5": "22"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.TypeOfService != string(claim.PlaceOfServiceOffSite) {
		t.Errorf("TypeOfService: got %q want offsite", got.TypeOfService)
	}
}

func Test_CLM_Segment_EmptyAmount_TotalChargeZero(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("CLM", map[string]interface{}{"1": "Y"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if !got.TotalCharge.Equal(decimal.Zero) {
		t.Errorf("TotalCharge: got %v want zero", got.TotalCharge)
	}
}

func Test_CLM_Segment_TableDriven(t *testing.T) {
	tests := []struct {
		name          string
		fields        map[string]interface{}
		wantClaimId   string
		wantCharge    string
		wantFreq      string
		wantPOS       string
	}{
		{"Basic_ClaimId_Amount", map[string]interface{}{"1": "C001", "2": "100.00"}, "C001", "100.00", "", ""},
		{"With_Frequency", map[string]interface{}{"1": "C002", "5-2": "7"}, "C002", "0", "7", ""},
		{"POS_11_Onsite", map[string]interface{}{"1": "C003", "5": "11"}, "C003", "0", "", "onsite"},
		{"POS_21_Offsite", map[string]interface{}{"1": "C004", "5": "21"}, "C004", "0", "", "offsite"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a, _ := newTestAPI(t)
			segments := []RawSegment837{seg("CLM", tt.fields)}
			got := a.mapSingleClaimFromSegments(segments)
			if got.ClaimId != tt.wantClaimId {
				t.Errorf("ClaimId: got %q want %q", got.ClaimId, tt.wantClaimId)
			}
			if !got.TotalCharge.Equal(mustDecimal(tt.wantCharge)) {
				t.Errorf("TotalCharge: got %v want %s", got.TotalCharge, tt.wantCharge)
			}
			if got.ClaimFrequency != tt.wantFreq {
				t.Errorf("ClaimFrequency: got %q want %q", got.ClaimFrequency, tt.wantFreq)
			}
			if got.TypeOfService != tt.wantPOS {
				t.Errorf("TypeOfService: got %q want %q", got.TypeOfService, tt.wantPOS)
			}
		})
	}
}

func Test_DTP_434_DateRange_SetsFromAndToDates(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("DTP", map[string]interface{}{"1": "434", "3": "20230101-20230115"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if !got.ServiceDateFrom.Equal(mustParseDate("20230101")) {
		t.Errorf("ServiceDateFrom: got %v", got.ServiceDateFrom)
	}
	if !got.ServiceDateTo.Equal(mustParseDate("20230115")) {
		t.Errorf("ServiceDateTo: got %v", got.ServiceDateTo)
	}
}

func Test_DTP_434_SingleDate_SetsFromAndToSame(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("DTP", map[string]interface{}{"1": "434", "3": "20230201"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	d := mustParseDate("20230201")
	if !got.ServiceDateFrom.Equal(d) || !got.ServiceDateTo.Equal(d) {
		t.Errorf("ServiceDateFrom/To: got %v / %v", got.ServiceDateFrom, got.ServiceDateTo)
	}
}

func Test_DTP_431_SetsClaimSubmissionDate(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("DTP", map[string]interface{}{"1": "431", "3": "20230301"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if !got.ClaimSubittionDate.Equal(mustParseDate("20230301")) {
		t.Errorf("ClaimSubittionDate: got %v", got.ClaimSubittionDate)
	}
}

func Test_DTP_472_SetsServiceDateFrom(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("DTP", map[string]interface{}{"1": "472", "3": "20230401"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if !got.ServiceDateFrom.Equal(mustParseDate("20230401")) {
		t.Errorf("ServiceDateFrom: got %v", got.ServiceDateFrom)
	}
}

func Test_DTP_EmptyDate_Ignored(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("DTP", map[string]interface{}{"1": "434", "3": ""}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	var z time.Time
	if !got.ServiceDateFrom.Equal(z) {
		t.Errorf("expected zero ServiceDateFrom, got %v", got.ServiceDateFrom)
	}
}

func Test_DTP_UnknownType_Ignored(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("DTP", map[string]interface{}{"1": "999", "3": "20230101"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	var z time.Time
	if !got.ServiceDateFrom.Equal(z) {
		t.Errorf("expected zero for unknown DTP type, got %v", got.ServiceDateFrom)
	}
}

func Test_DTP_Segment_TableDriven(t *testing.T) {
	tests := []struct {
		name           string
		dtpType        string
		dateStr        string
		checkField     string
		wantDateStr    string
	}{
		{"434_Range_From", "434", "20230101-20230115", "from", "20230101"},
		{"434_Range_To", "434", "20230101-20230115", "to", "20230115"},
		{"434_Single", "434", "20230201", "from", "20230201"},
		{"431_Submission", "431", "20230301", "submission", "20230301"},
		{"472_ServiceFrom", "472", "20230401", "from", "20230401"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a, _ := newTestAPI(t)
			segments := []RawSegment837{seg("DTP", map[string]interface{}{"1": tt.dtpType, "3": tt.dateStr})}
			got := a.mapSingleClaimFromSegments(segments)
			wantDate := mustParseDate(tt.wantDateStr)
			switch tt.checkField {
			case "from":
				if !got.ServiceDateFrom.Equal(wantDate) {
					t.Errorf("ServiceDateFrom: got %v want %v", got.ServiceDateFrom, wantDate)
				}
			case "to":
				if !got.ServiceDateTo.Equal(wantDate) {
					t.Errorf("ServiceDateTo: got %v want %v", got.ServiceDateTo, wantDate)
				}
			case "submission":
				if !got.ClaimSubittionDate.Equal(wantDate) {
					t.Errorf("ClaimSubittionDate: got %v want %v", got.ClaimSubittionDate, wantDate)
				}
			}
		})
	}
}

func Test_NM1_IL_SetsPatientIdAndName(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("NM1", map[string]interface{}{"1": "IL", "3": "DOE", "4": "JOHN", "9": "MEM001"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.PatientId != "MEM001" {
		t.Errorf("PatientId: got %q want MEM001", got.PatientId)
	}
	if got.PatientName != "JOHN DOE" {
		t.Errorf("PatientName: got %q want JOHN DOE", got.PatientName)
	}
}

func Test_NM1_IL_FirstNameOnly(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("NM1", map[string]interface{}{"1": "IL", "4": "JANE"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.PatientName != "JANE" {
		t.Errorf("PatientName: got %q want JANE", got.PatientName)
	}
}

func Test_NM1_IL_LastNameOnly(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("NM1", map[string]interface{}{"1": "IL", "3": "SMITH"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.PatientName != "SMITH" {
		t.Errorf("PatientName: got %q want SMITH", got.PatientName)
	}
}

func Test_NM1_IL_BothEmpty_NoPatientName(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("NM1", map[string]interface{}{"1": "IL", "9": "X"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.PatientName != "" {
		t.Errorf("PatientName: got %q want empty", got.PatientName)
	}
}

func Test_NM1_PR_PrimaryInsurance_WhenSBR_P(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("SBR", map[string]interface{}{"1": "P"}),
		seg("NM1", map[string]interface{}{"1": "PR", "3": "Aetna", "9": "INS123"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.PrimaryInsuranceName != "Aetna" || got.PrimaryInsuranceId != "INS123" {
		t.Errorf("Primary: got %q / %q want Aetna / INS123", got.PrimaryInsuranceName, got.PrimaryInsuranceId)
	}
	if got.SecondaryInsuranceName != "" || got.SecondaryInsuranceId != "" {
		t.Errorf("Secondary should be empty")
	}
}

func Test_NM1_PR_SecondaryInsurance_WhenSBR_NotP(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("SBR", map[string]interface{}{"1": "S"}),
		seg("NM1", map[string]interface{}{"1": "PR", "3": "BCBS", "9": "SEC456"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.SecondaryInsuranceName != "BCBS" || got.SecondaryInsuranceId != "SEC456" {
		t.Errorf("Secondary: got %q / %q want BCBS / SEC456", got.SecondaryInsuranceName, got.SecondaryInsuranceId)
	}
	if got.PrimaryInsuranceName != "" || got.PrimaryInsuranceId != "" {
		t.Errorf("Primary should be empty")
	}
}

func Test_LX_Segment_SetsLineNumber_ForSubsequentSV1SV2(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("LX", map[string]interface{}{"1": "1"}),
		seg("SV1", map[string]interface{}{"1-1": "99213", "2": "100.00", "3": "HC", "4": "1"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if len(got.ServiceLines) != 1 {
		t.Fatalf("expected 1 service line, got %d", len(got.ServiceLines))
	}
	if got.ServiceLines[0].LineNumber != "1" {
		t.Errorf("LineNumber: got %q want 1", got.ServiceLines[0].LineNumber)
	}
}

func Test_SV1_Segment_CPTCode_Units_Amount_Modifiers(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("LX", map[string]interface{}{"1": "1"}),
		seg("SV1", map[string]interface{}{
			"1-1": "99213", "1-2": "AH", "1-3": "AJ",
			"2": "85.50", "3": "HC", "4": "2",
		}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if len(got.ServiceLines) != 1 {
		t.Fatalf("expected 1 service line, got %d", len(got.ServiceLines))
	}
	sl := got.ServiceLines[0]
	if sl.CPTCode != "99213" || sl.Code != "HC" || sl.Units != 2 {
		t.Errorf("CPTCode/Code/Units: got %q / %q / %d", sl.CPTCode, sl.Code, sl.Units)
	}
	if !sl.Amount.Equal(mustDecimal("85.50")) {
		t.Errorf("Amount: got %v", sl.Amount)
	}
	if len(sl.Modifiers) != 2 || sl.Modifiers[0] != "AH" || sl.Modifiers[1] != "AJ" {
		t.Errorf("Modifiers: got %v", sl.Modifiers)
	}
}

func Test_SV1_InvalidModifier_Ignored(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("SV1", map[string]interface{}{"1-1": "99214", "1-2": "XX", "2": "90", "3": "HC", "4": "1"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if len(got.ServiceLines[0].Modifiers) != 0 {
		t.Errorf("expected no modifiers, got %v", got.ServiceLines[0].Modifiers)
	}
}

func Test_SV1_ModifierCaseInsensitive_Accepted(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("SV1", map[string]interface{}{"1-1": "99213", "1-2": "ah", "2": "50", "3": "HC", "4": "1"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if len(got.ServiceLines[0].Modifiers) != 1 || got.ServiceLines[0].Modifiers[0] != "ah" {
		t.Errorf("modifier ah should be accepted: got %v", got.ServiceLines[0].Modifiers)
	}
}

func Test_SV2_Segment_CPTCode_Units_Amount_Code(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("LX", map[string]interface{}{"1": "2"}),
		seg("SV2", map[string]interface{}{
			"2-1": "97110", "2-2": "HO", "3": "75.00", "4": "DA", "5": "3",
		}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if len(got.ServiceLines) != 1 {
		t.Fatalf("expected 1 service line, got %d", len(got.ServiceLines))
	}
	sl := got.ServiceLines[0]
	if sl.CPTCode != "97110" || sl.Code != "DA" || sl.Units != 3 {
		t.Errorf("CPTCode/Code/Units: got %q / %q / %d", sl.CPTCode, sl.Code, sl.Units)
	}
	if !sl.Amount.Equal(mustDecimal("75.00")) {
		t.Errorf("Amount: got %v", sl.Amount)
	}
	if len(sl.Modifiers) != 1 || sl.Modifiers[0] != "HO" {
		t.Errorf("Modifiers: got %v", sl.Modifiers)
	}
}

func Test_SV2_CodeDA_SetsTypeOfService_FromField1(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("SV2", map[string]interface{}{"1": "TELEHEALTH", "2-1": "99213", "3": "50", "4": "DA", "5": "1"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.TypeOfService != "TELEHEALTH" {
		t.Errorf("TypeOfService: got %q want TELEHEALTH", got.TypeOfService)
	}
}

func Test_SBR_Segment_P_SetsPrimaryInsurance(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("SBR", map[string]interface{}{"1": "P"}),
		seg("NM1", map[string]interface{}{"1": "PR", "3": "Prim", "9": "P1"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.PrimaryInsuranceName != "Prim" || got.PrimaryInsuranceId != "P1" {
		t.Errorf("Primary: got %q / %q", got.PrimaryInsuranceName, got.PrimaryInsuranceId)
	}
}

func Test_SBR_Segment_NonP_SetsSecondary(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("SBR", map[string]interface{}{"1": "S"}),
		seg("NM1", map[string]interface{}{"1": "PR", "3": "Sec", "9": "S1"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.SecondaryInsuranceName != "Sec" || got.SecondaryInsuranceId != "S1" {
		t.Errorf("Secondary: got %q / %q", got.SecondaryInsuranceName, got.SecondaryInsuranceId)
	}
}

func Test_REF_F8_SetsOriginalClaimNumber(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("REF", map[string]interface{}{"1": "F8", "2": "ORIG-123"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.OriginalClaimNumber != "ORIG-123" {
		t.Errorf("OriginalClaimNumber: got %q want ORIG-123", got.OriginalClaimNumber)
	}
}

func Test_REF_NonF8_NoChange(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("REF", map[string]interface{}{"1": "1L", "2": "X"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.OriginalClaimNumber != "" {
		t.Errorf("OriginalClaimNumber: got %q want empty", got.OriginalClaimNumber)
	}
}

func Test_ST_Segment_Ignored(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("ST", map[string]interface{}{"1": "837", "2": "0001"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.ClaimId != "" {
		t.Errorf("ST should be ignored, ClaimId got %q", got.ClaimId)
	}
}

func Test_Modifiers_AllowedSet_AH_AJ_HO_AF_AG_SA(t *testing.T) {
	a, _ := newTestAPI(t)
	for _, m := range []string{"AH", "AJ", "HO", "AF", "AG", "SA"} {
		t.Run("Modifier_"+m, func(t *testing.T) {
			segments := []RawSegment837{
				seg("SV1", map[string]interface{}{"1-1": "99213", "1-2": m, "2": "50", "3": "HC", "4": "1"}),
			}
			got := a.mapSingleClaimFromSegments(segments)
			if len(got.ServiceLines) != 1 || len(got.ServiceLines[0].Modifiers) != 1 || got.ServiceLines[0].Modifiers[0] != m {
				t.Errorf("modifier %q: got %v", m, got.ServiceLines[0].Modifiers)
			}
		})
	}
}

func Test_ParseDecimal_Invalid_LogsAndReturnsZero(t *testing.T) {
	a, log := newTestAPI(t)
	segments := []RawSegment837{
		seg("CLM", map[string]interface{}{"1": "X", "2": "not-a-number"}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if !got.TotalCharge.Equal(decimal.Zero) {
		t.Errorf("TotalCharge: got %v want zero", got.TotalCharge)
	}
	if len(log.Calls) == 0 {
		t.Fatal("expected at least one Error log for invalid decimal")
	}
	found := false
	for _, c := range log.Calls {
		if c.Msg == "error parsing decimal" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected 'error parsing decimal' log, got %v", log.Calls)
	}
}

func Test_GetClaimString_NonStringValue_ReturnsEmpty(t *testing.T) {
	a, _ := newTestAPI(t)
	segments := []RawSegment837{
		seg("CLM", map[string]interface{}{"1": 12345}),
	}
	got := a.mapSingleClaimFromSegments(segments)
	if got.ClaimId != "" {
		t.Errorf("ClaimId with non-string: got %q want empty", got.ClaimId)
	}
}
