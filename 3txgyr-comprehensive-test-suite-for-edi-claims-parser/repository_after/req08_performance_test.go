// REQ8: Test suite must complete in under 30 seconds.
package collaborate

import (
	"sync"
	"testing"
)

var benchSegments = []RawSegment837{
	seg("BHT", map[string]interface{}{"4": "20230115"}),
	seg("CLM", map[string]interface{}{"1": "CLM-1", "2": "250.00", "5": "11", "5-2": "1"}),
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


func Benchmark_MapSegments(b *testing.B) {
	a := &api{Logger: &MockLogger{}}
	b.ReportAllocs() // REQ8: Memory allocation tracking
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = a.mapSingleClaimFromSegments(benchSegments)
	}
}

func Benchmark_MapSegments_Parallel(b *testing.B) {
	a := &api{Logger: &MockLogger{}}
	b.ReportAllocs()
	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_ = a.mapSingleClaimFromSegments(benchSegments)
		}
	})
}

func Benchmark_MapSegments_ConcurrentRace(b *testing.B) {
	a := &api{Logger: &MockLogger{}}
	b.ReportAllocs() 
	b.ResetTimer()
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < (b.N+9)/10; j++ {
				_ = a.mapSingleClaimFromSegments(benchSegments)
			}
		}()
	}
	wg.Wait()
}

func Benchmark_MapSegments_SmallInput(b *testing.B) {
	a := &api{Logger: &MockLogger{}}
	small := []RawSegment837{
		seg("CLM", map[string]interface{}{"1": "X", "2": "100"}),
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = a.mapSingleClaimFromSegments(small)
	}
}

func Benchmark_MapSegments_LargeInput(b *testing.B) {
	a := &api{Logger: &MockLogger{}}
	large := make([]RawSegment837, 0, 50)
	large = append(large, seg("CLM", map[string]interface{}{"1": "LARGE", "2": "1000"}))
	for i := 1; i <= 20; i++ {
		large = append(large, seg("LX", map[string]interface{}{"1": string(rune('0' + i%10))}))
		large = append(large, seg("SV1", map[string]interface{}{"1-1": "99213", "2": "100", "3": "HC", "4": "1"}))
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = a.mapSingleClaimFromSegments(large)
	}
}
