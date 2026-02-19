// REQ3
package collaborate

import (
	"strconv"
	"sync"
	"testing"

	claim "github.com/aci/backend/internal/core/services/claim"
)

func Test_Concurrent_MapSegments_10Goroutines(t *testing.T) {
	log := &MockLogger{}
	a := &api{Logger: log}

	buildSegments := func(id int) []RawSegment837 {
		return []RawSegment837{
			seg("BHT", map[string]interface{}{"4": "20230115"}),
			seg("CLM", map[string]interface{}{"1": "CLM-" + strconv.Itoa(id), "2": "100"}),
			seg("NM1", map[string]interface{}{"1": "IL", "3": "LN", "4": "FN", "9": "P1"}),
		}
	}

	const N = 12 // 12 goroutines (> 10 as required)
	var wg sync.WaitGroup
	results := make([]claim.Claim, N)
	for i := 0; i < N; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			results[idx] = a.mapSingleClaimFromSegments(buildSegments(idx))
		}(i)
	}
	wg.Wait()

	// Verify each goroutine got correct independent results
	for i := 0; i < N; i++ {
		c := results[i]
		wantId := "CLM-" + strconv.Itoa(i)
		if c.ClaimId != wantId {
			t.Errorf("goroutine %d: ClaimId %q want %q", i, c.ClaimId, wantId)
		}
		if c.PatientName != "FN LN" {
			t.Errorf("goroutine %d: PatientName %q", i, c.PatientName)
		}
	}
}

func Test_Concurrent_MapSegments_50Goroutines(t *testing.T) {
	log := &MockLogger{}
	a := &api{Logger: log}

	const N = 50
	var wg sync.WaitGroup
	results := make([]claim.Claim, N)

	for i := 0; i < N; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			segments := []RawSegment837{
				seg("CLM", map[string]interface{}{"1": "STRESS-" + strconv.Itoa(idx), "2": "200"}),
				seg("SBR", map[string]interface{}{"1": "P"}),
				seg("NM1", map[string]interface{}{"1": "PR", "3": "Insurance-" + strconv.Itoa(idx), "9": "INS" + strconv.Itoa(idx)}),
			}
			results[idx] = a.mapSingleClaimFromSegments(segments)
		}(i)
	}
	wg.Wait()

	for i := 0; i < N; i++ {
		wantId := "STRESS-" + strconv.Itoa(i)
		wantIns := "Insurance-" + strconv.Itoa(i)
		if results[i].ClaimId != wantId {
			t.Errorf("goroutine %d: ClaimId %q want %q", i, results[i].ClaimId, wantId)
		}
		if results[i].PrimaryInsuranceName != wantIns {
			t.Errorf("goroutine %d: PrimaryInsuranceName %q want %q", i, results[i].PrimaryInsuranceName, wantIns)
		}
	}
}

func Test_Concurrent_MockLogger_ThreadSafe(t *testing.T) {
	log := &MockLogger{}
	a := &api{Logger: log}

	const N = 100
	var wg sync.WaitGroup

	for i := 0; i < N; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			// Force Error log by using invalid decimal
			segments := []RawSegment837{
				seg("CLM", map[string]interface{}{"1": "X", "2": "invalid-" + strconv.Itoa(idx)}),
			}
			_ = a.mapSingleClaimFromSegments(segments)
		}(i)
	}
	wg.Wait()

	// Should have N error logs, all written without data races
	if len(log.Calls) != N {
		t.Errorf("expected %d log calls, got %d", N, len(log.Calls))
	}
}

func Test_Concurrent_MixedOperations(t *testing.T) {
	log := &MockLogger{}
	a := &api{Logger: log}

	const N = 20
	var wg sync.WaitGroup

	// Mix of valid and invalid operations
	for i := 0; i < N; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			var segments []RawSegment837
			if idx%2 == 0 {
				// Valid
				segments = []RawSegment837{
					seg("CLM", map[string]interface{}{"1": "VALID-" + strconv.Itoa(idx), "2": "100"}),
				}
			} else {
				// Invalid decimal (triggers logger)
				segments = []RawSegment837{
					seg("CLM", map[string]interface{}{"1": "INVALID-" + strconv.Itoa(idx), "2": "bad"}),
				}
			}
			_ = a.mapSingleClaimFromSegments(segments)
		}(i)
	}
	wg.Wait()

	// Should complete without race conditions
	// (run with -race to verify)
}
