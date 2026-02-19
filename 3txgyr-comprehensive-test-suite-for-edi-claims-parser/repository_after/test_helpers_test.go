// REQ6: Go 1.21+
package collaborate

import (
	"testing"
	"time"

	claim "github.com/aci/backend/internal/core/services/claim"
	"github.com/shopspring/decimal"
)

func mustParseDate(s string) time.Time {
	t, err := time.Parse("20060102", s)
	if err != nil {
		return time.Time{}
	}
	return t
}

func mustDecimal(s string) decimal.Decimal {
	d, _ := decimal.NewFromString(s)
	return d
}

func seg(name string, fields map[string]interface{}) RawSegment837 {
	m := make(RawSegment837)
	m["name"] = name
	for k, v := range fields {
		m[k] = v
	}
	return m
}

func newTestAPI(t *testing.T) (*api, *MockLogger) {
	t.Helper()
	m := &MockLogger{}
	return &api{Logger: m}, m
}

func assertClaimEqual(t *testing.T, got, want claim.Claim) {
	t.Helper()
	if got.ClaimId != want.ClaimId {
		t.Errorf("ClaimId: got %q want %q", got.ClaimId, want.ClaimId)
	}
	if !got.ClaimSubittionDate.Equal(want.ClaimSubittionDate) {
		t.Errorf("ClaimSubittionDate: got %v want %v", got.ClaimSubittionDate, want.ClaimSubittionDate)
	}
	if !got.ServiceDateFrom.Equal(want.ServiceDateFrom) {
		t.Errorf("ServiceDateFrom: got %v want %v", got.ServiceDateFrom, want.ServiceDateFrom)
	}
	if !got.ServiceDateTo.Equal(want.ServiceDateTo) {
		t.Errorf("ServiceDateTo: got %v want %v", got.ServiceDateTo, want.ServiceDateTo)
	}
	if !got.TotalCharge.Equal(want.TotalCharge) {
		t.Errorf("TotalCharge: got %v want %v", got.TotalCharge, want.TotalCharge)
	}
	if got.ClaimFrequency != want.ClaimFrequency {
		t.Errorf("ClaimFrequency: got %q want %q", got.ClaimFrequency, want.ClaimFrequency)
	}
	if got.TypeOfService != want.TypeOfService {
		t.Errorf("TypeOfService: got %q want %q", got.TypeOfService, want.TypeOfService)
	}
	if got.PatientId != want.PatientId {
		t.Errorf("PatientId: got %q want %q", got.PatientId, want.PatientId)
	}
	if got.PatientName != want.PatientName {
		t.Errorf("PatientName: got %q want %q", got.PatientName, want.PatientName)
	}
	if got.PrimaryInsuranceName != want.PrimaryInsuranceName {
		t.Errorf("PrimaryInsuranceName: got %q want %q", got.PrimaryInsuranceName, want.PrimaryInsuranceName)
	}
	if got.PrimaryInsuranceId != want.PrimaryInsuranceId {
		t.Errorf("PrimaryInsuranceId: got %q want %q", got.PrimaryInsuranceId, want.PrimaryInsuranceId)
	}
	if got.SecondaryInsuranceName != want.SecondaryInsuranceName {
		t.Errorf("SecondaryInsuranceName: got %q want %q", got.SecondaryInsuranceName, want.SecondaryInsuranceName)
	}
	if got.SecondaryInsuranceId != want.SecondaryInsuranceId {
		t.Errorf("SecondaryInsuranceId: got %q want %q", got.SecondaryInsuranceId, want.SecondaryInsuranceId)
	}
	if got.OriginalClaimNumber != want.OriginalClaimNumber {
		t.Errorf("OriginalClaimNumber: got %q want %q", got.OriginalClaimNumber, want.OriginalClaimNumber)
	}
	if len(got.ServiceLines) != len(want.ServiceLines) {
		t.Errorf("ServiceLines len: got %d want %d", len(got.ServiceLines), len(want.ServiceLines))
	} else {
		for i := range got.ServiceLines {
			g, w := got.ServiceLines[i], want.ServiceLines[i]
			if g.LineNumber != w.LineNumber || g.CPTCode != w.CPTCode || g.Code != w.Code ||
				g.Units != w.Units || !g.Amount.Equal(w.Amount) {
				t.Errorf("ServiceLines[%d]: got %+v want %+v", i, g, w)
			}
			if len(g.Modifiers) != len(w.Modifiers) {
				t.Errorf("ServiceLines[%d].Modifiers len: got %d want %d", i, len(g.Modifiers), len(w.Modifiers))
			} else {
				for j := range g.Modifiers {
					if g.Modifiers[j] != w.Modifiers[j] {
						t.Errorf("ServiceLines[%d].Modifiers[%d]: got %q want %q", i, j, g.Modifiers[j], w.Modifiers[j])
					}
				}
			}
		}
	}
}
