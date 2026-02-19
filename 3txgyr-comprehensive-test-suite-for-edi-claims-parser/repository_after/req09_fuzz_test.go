// REQ9: Must include 3+ fuzz tests using Go 1.18+ testing
package collaborate

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"testing"
)


func Fuzz_MapSegments_RandomEDI(f *testing.F) {
	// Seed corpus with valid-ish data
	f.Add([]byte("BHT420230115CLM01X02100"))
	f.Add([]byte("NM11ILDOEJOHN9P1"))
	f.Add([]byte("DTP434320230101"))
	f.Add([]byte("SV1199213AH285HC41"))

	f.Fuzz(func(t *testing.T, data []byte) {
		if len(data) < 3 {
			return
		}
		segments := make([]RawSegment837, 0, 8)
		for i := 0; i < 8; i++ {
			off := i * 4
			if off+2 >= len(data) {
				break
			}
			m := make(RawSegment837)
			m["name"] = string(data[off : off+1])
			m["1"] = string(data[off+1 : off+2])
			if off+3 < len(data) {
				m["2"] = string(data[off+2 : off+3])
			}
			segments = append(segments, m)
		}
		if len(segments) == 0 {
			return
		}
		a, _ := newTestAPI(t)
		// Should not panic regardless of input
		_ = a.mapSingleClaimFromSegments(segments)
	})
}

func Fuzz_ZIP_Corrupt(f *testing.F) {
	f.Add([]byte("PK"))
	f.Add([]byte("PK\x03\x04"))
	f.Add([]byte("not a zip at all"))
	f.Add([]byte{0x50, 0x4b, 0x03, 0x04, 0x00, 0x00})

	f.Fuzz(func(t *testing.T, data []byte) {
		if len(data) == 0 {
			return
		}
		// Should not panic regardless of input
		r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
		if err != nil {
			return // Expected for invalid data
		}
		for _, zf := range r.File {
			_ = zf.Name
			rc, err := zf.Open()
			if err == nil {
				_ = rc.Close()
			}
		}
	})
}

func Fuzz_JSON_Malformed(f *testing.F) {
	f.Add([]byte(`{}`))
	f.Add([]byte(`{"segments":[]}`))
	f.Add([]byte(`{"segments":[{"name":"BHT"}]}`))
	f.Add([]byte(`{"segments":[}`))
	f.Add([]byte(`not json`))
	f.Add([]byte(`{"segments": null}`))

	f.Fuzz(func(t *testing.T, data []byte) {
		if len(data) == 0 {
			return
		}
		var v EDIResponse
		_ = json.Unmarshal(data, &v)
	})
}

func Fuzz_SegmentName_Random(f *testing.F) {
	f.Add("BHT")
	f.Add("CLM")
	f.Add("NM1")
	f.Add("random")
	f.Add("")
	f.Add("VERYLONGSEGMENTNAME")

	f.Fuzz(func(t *testing.T, name string) {
		a, _ := newTestAPI(t)
		segments := []RawSegment837{
			seg(name, map[string]interface{}{"1": "test", "2": "100"}),
		}
		_ = a.mapSingleClaimFromSegments(segments)
	})
}
