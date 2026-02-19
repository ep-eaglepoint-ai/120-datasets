package collaborate

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	claim "github.com/aci/backend/internal/core/services/claim"
)

func Test_ParseClaimEdi_InvalidEDIContainsErrorMessage_ReturnsError(t *testing.T) {
	a, _ := newTestAPI(t)
	raw := "Please contact customer support for assistance."
	_, err := a.parseClaimEdi(raw)
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "invalid EDI data") {
		t.Errorf("error must mention invalid EDI data: %v", err)
	}
	if !strings.Contains(err.Error(), "error message") {
		t.Errorf("error must mention error message: %v", err)
	}
}

func Test_ParseClaimEdi_HTTPNon200_ReturnsErrorWithStatus(t *testing.T) {
	mux := startParseServerOn3000(t)
	mux.HandleFunc("/parse", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("internal error"))
	})

	a, _ := newTestAPI(t)
	_, err := a.parseClaimEdi("valid edi content")
	if err == nil {
		t.Fatal("expected error")
	}
	// REQ2: Error message must contain HTTP status for ops troubleshooting
	if !strings.Contains(err.Error(), "HTTP request failed with status:") {
		t.Errorf("error must include HTTP status: %v", err)
	}
	if !strings.Contains(err.Error(), "500") {
		t.Errorf("error must include 500: %v", err)
	}
}

func Test_ParseClaimEdi_HTTP400_BadRequest_ReturnsError(t *testing.T) {
	mux := startParseServerOn3000(t)
	mux.HandleFunc("/parse", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte("bad request"))
	})

	a, _ := newTestAPI(t)
	_, err := a.parseClaimEdi("edi")
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "400") {
		t.Errorf("error must include 400: %v", err)
	}
}

func Test_ParseClaimEdi_HTTP503_ServiceUnavailable_ReturnsError(t *testing.T) {
	mux := startParseServerOn3000(t)
	mux.HandleFunc("/parse", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	})

	a, _ := newTestAPI(t)
	_, err := a.parseClaimEdi("edi")
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "503") {
		t.Errorf("error must include 503: %v", err)
	}
}

func Test_ParseClaimEdi_MalformedJSON_ReturnsUnmarshalError_ErrorsAs(t *testing.T) {
	mux := startParseServerOn3000(t)
	mux.HandleFunc("/parse", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"segments": [}`)) // Invalid JSON
	})

	a, _ := newTestAPI(t)
	_, err := a.parseClaimEdi("edi")
	if err == nil {
		t.Fatal("expected error")
	}
	var je *json.SyntaxError
	if !errors.As(err, &je) {
		// Fallback: check error message contains JSON-related text
		if !strings.Contains(err.Error(), "json") && !strings.Contains(err.Error(), "unmarshal") &&
			!strings.Contains(err.Error(), "unexpected") && !strings.Contains(err.Error(), "Syntax") {
			t.Errorf("error should relate to JSON parsing: %v", err)
		}
	}
}

func Test_ParseClaimEdi_EmptyJSON_ReturnsError(t *testing.T) {
	mux := startParseServerOn3000(t)
	mux.HandleFunc("/parse", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(``)) // Empty response
	})

	a, _ := newTestAPI(t)
	_, err := a.parseClaimEdi("edi")
	if err == nil {
		t.Fatal("expected error for empty JSON response")
	}
}

func Test_ParseClaimEdi_TruncatedJSON_ReturnsError(t *testing.T) {
	mux := startParseServerOn3000(t)
	mux.HandleFunc("/parse", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"segments": [`)) // Truncated
	})

	a, _ := newTestAPI(t)
	_, err := a.parseClaimEdi("edi")
	if err == nil {
		t.Fatal("expected error for truncated JSON")
	}
}

// =============================================================================
// ZIP FILE READ ERROR TESTS - Using errors.As()
// =============================================================================

func setupClaimzips(t *testing.T) (cleanup func()) {
	t.Helper()
	dir := t.TempDir()
	claimzips := filepath.Join(dir, "claimzips")
	if err := os.MkdirAll(claimzips, 0755); err != nil {
		t.Fatalf("mkdir claimzips: %v", err)
	}
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatalf("chdir: %v", err)
	}
	return func() {
		_ = os.Chdir(cwd)
	}
}

func Test_GetClaimsFileDebug_NoClaimzipsDir_ReturnsWrappedError_ErrorsAs(t *testing.T) {
	dir := t.TempDir()
	cwd, _ := os.Getwd()
	defer func() { _ = os.Chdir(cwd) }()
	_ = os.Chdir(dir)

	a, _ := newTestAPI(t)
	_, err := a.GetClaimsFileDebug(context.Background(), time.Time{})
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "failed to read claimzips directory") {
		t.Errorf("error should mention claimzips: %v", err)
	}
	var pathErr *fs.PathError
	if !errors.As(err, &pathErr) {
		if !strings.Contains(err.Error(), "claimzips") {
			t.Errorf("error chain should reference claimzips: %v", err)
		}
	}
}

func Test_GetClaimsFileDebug_CorruptZip_LogsAndSkips(t *testing.T) {
	cleanup := setupClaimzips(t)
	defer cleanup()

	corrupt := filepath.Join("claimzips", "bad.zip")
	if err := os.WriteFile(corrupt, []byte("not a zip"), 0644); err != nil {
		t.Fatalf("write corrupt zip: %v", err)
	}

	log := &MockLogger{}
	a := &api{Logger: log}
	claims, err := a.GetClaimsFileDebug(context.Background(), time.Time{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(claims) != 0 {
		t.Errorf("expected no claims, got %d", len(claims))
	}
	found := false
	var loggedPath string
	for _, c := range log.Calls {
		if c.Msg == "failed to open zip file" {
			found = true
			for k := 0; k < len(c.KeysAndValues); k += 2 {
				if k+1 < len(c.KeysAndValues) && c.KeysAndValues[k] == "file" {
					if s, ok := c.KeysAndValues[k+1].(string); ok {
						loggedPath = s
					}
					break
				}
			}
			break
		}
	}
	if !found {
		t.Errorf("expected 'failed to open zip file' log, got %v", log.Calls)
	}
	if found && loggedPath != "" && !strings.Contains(loggedPath, "bad.zip") {
		t.Errorf("log should contain file name bad.zip for ops troubleshooting: %q", loggedPath)
	}
}

func Test_GetClaimsFileDebug_EmptyClaimzips_ReturnsNilClaims(t *testing.T) {
	cleanup := setupClaimzips(t)
	defer cleanup()

	a, _ := newTestAPI(t)
	claims, err := a.GetClaimsFileDebug(context.Background(), time.Time{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(claims) != 0 {
		t.Errorf("expected no claims, got %d", len(claims))
	}
}

func Test_GetClaimsFileDebug_Compound_CorruptZipAndValidZip_ProcessesValidOnly(t *testing.T) {
	mux := startParseServerOn3000(t)
	mux.HandleFunc("/parse", func(w http.ResponseWriter, r *http.Request) {
		respondJSON(w, http.StatusOK, EDIResponse{
			Segments: []RawSegment837{seg("CLM", map[string]interface{}{"1": "COMPOUND-CLM"})},
		})
	})
	cleanup := setupClaimzips(t)
	defer cleanup()

	badPath := filepath.Join("claimzips", "corrupt.zip")
	if err := os.WriteFile(badPath, []byte("not a zip"), 0644); err != nil {
		t.Fatalf("write corrupt: %v", err)
	}
	var zb bytes.Buffer
	zw := zip.NewWriter(&zb)
	f, _ := zw.Create("c.837")
	_, _ = f.Write([]byte("ISA*00*..."))
	_ = zw.Close()
	okPath := filepath.Join("claimzips", "ok.zip")
	if err := os.WriteFile(okPath, zb.Bytes(), 0644); err != nil {
		t.Fatalf("write ok zip: %v", err)
	}

	log := &MockLogger{}
	a := &api{Logger: log}
	claims, err := a.GetClaimsFileDebug(context.Background(), time.Time{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(claims) != 1 {
		t.Fatalf("expected 1 claim (valid only), got %d", len(claims))
	}
	if claims[0].ClaimId != "COMPOUND-CLM" {
		t.Errorf("ClaimId: got %q want COMPOUND-CLM", claims[0].ClaimId)
	}
	foundCorruptLog := false
	for _, c := range log.Calls {
		if c.Msg == "failed to open zip file" {
			foundCorruptLog = true
			break
		}
	}
	if !foundCorruptLog {
		t.Error("expected log for corrupt zip skip")
	}
}

func Test_GetClaimsFileDebug_ValidZipWithEDI_ProcessesClaim(t *testing.T) {
	mux := startParseServerOn3000(t)
	mux.HandleFunc("/parse", func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		if strings.Contains(string(body), "Please contact customer") {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"segments":[]}`))
			return
		}
		respondJSON(w, http.StatusOK, EDIResponse{
			Segments: []RawSegment837{
				seg("CLM", map[string]interface{}{"1": "FILE-CLM-1"}),
			},
		})
	})

	cleanup := setupClaimzips(t)
	defer cleanup()

	var zb bytes.Buffer
	zw := zip.NewWriter(&zb)
	f, _ := zw.Create("claim.837")
	_, _ = f.Write([]byte("ISA*00*..."))
	_ = zw.Close()
	zipPath := filepath.Join("claimzips", "ok.zip")
	if err := os.WriteFile(zipPath, zb.Bytes(), 0644); err != nil {
		t.Fatalf("write zip: %v", err)
	}

	a, _ := newTestAPI(t)
	claims, err := a.GetClaimsFileDebug(context.Background(), time.Time{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(claims) != 1 {
		t.Fatalf("expected 1 claim, got %d", len(claims))
	}
	if claims[0].ClaimId != "FILE-CLM-1" {
		t.Errorf("ClaimId: got %q want FILE-CLM-1", claims[0].ClaimId)
	}
}

func Test_ParseClaimEdi_ContentTypeTextPlain_Sent(t *testing.T) {
	mux := startParseServerOn3000(t)
	var ct string
	var body []byte
	mux.HandleFunc("/parse", func(w http.ResponseWriter, r *http.Request) {
		ct = r.Header.Get("Content-Type")
		body, _ = io.ReadAll(r.Body)
		respondJSON(w, http.StatusOK, EDIResponse{Segments: []RawSegment837{}})
	})

	a, _ := newTestAPI(t)
	payload := "ISA*00*..."
	_, _ = a.parseClaimEdi(payload)
	if ct != "text/plain" {
		t.Errorf("Content-Type: got %q want text/plain", ct)
	}
	if string(body) != payload {
		t.Errorf("body: got %q want %q", body, payload)
	}
}

func Test_ParseClaimEdi_ValidJSON_SetsRawTextOnClaim(t *testing.T) {
	mux := startParseServerOn3000(t)
	mux.HandleFunc("/parse", func(w http.ResponseWriter, r *http.Request) {
		respondJSON(w, http.StatusOK, EDIResponse{
			Segments: []RawSegment837{
				seg("CLM", map[string]interface{}{"1": "C1"}),
			},
		})
	})

	a, _ := newTestAPI(t)
	raw := "ISA*00*..."
	got, err := a.parseClaimEdi(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.RawText != raw {
		t.Errorf("RawText: got %q want %q", got.RawText, raw)
	}
	if got.ClaimId != "C1" {
		t.Errorf("ClaimId: got %q want C1", got.ClaimId)
	}
}

func Test_ParseClaimEdi_EmptySegments_ReturnsEmptyClaim(t *testing.T) {
	mux := startParseServerOn3000(t)
	mux.HandleFunc("/parse", func(w http.ResponseWriter, r *http.Request) {
		respondJSON(w, http.StatusOK, EDIResponse{Segments: nil})
	})

	a, _ := newTestAPI(t)
	got, err := a.parseClaimEdi("x")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	var z claim.Claim
	if got.ClaimId != z.ClaimId || len(got.ServiceLines) != 0 {
		t.Errorf("expected empty claim: %+v", got)
	}
}

func Test_ContextCancel_GetClaimsFileDebug_DoesNotUseContext(t *testing.T) {
	cleanup := setupClaimzips(t)
	defer cleanup()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	a, _ := newTestAPI(t)
	claims, err := a.GetClaimsFileDebug(ctx, time.Time{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(claims) != 0 {
		t.Errorf("expected no claims: %d", len(claims))
	}
}

func Test_ParseClaimEdi_HTTPTimeout_ReturnsError(t *testing.T) {
	t.Skip("parseClaimEdi uses internal fixed timeouts; cannot inject context or client")
}
