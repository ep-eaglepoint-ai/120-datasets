package claim

import (
	"time"

	"github.com/shopspring/decimal"
)

type PlaceOfService string

const (
	PlaceOfServiceOnsite  PlaceOfService = "onsite"
	PlaceOfServiceOffSite PlaceOfService = "offsite"
)

type Claim struct {
	ClaimId                string
	ClaimSubittionDate     time.Time
	ServiceDateFrom        time.Time
	ServiceDateTo          time.Time
	TotalCharge            decimal.Decimal
	ClaimFrequency         string
	TypeOfService          string
	PatientId              string
	PatientName            string
	PrimaryInsuranceName   string
	PrimaryInsuranceId     string
	SecondaryInsuranceName string
	SecondaryInsuranceId   string
	OriginalClaimNumber    string
	ServiceLines           []ServiceLine
	RawText                string
}

type ServiceLine struct {
	LineNumber string
	CPTCode    string
	Modifiers  []string
	Code       string
	Units      int
	Amount     decimal.Decimal
}

