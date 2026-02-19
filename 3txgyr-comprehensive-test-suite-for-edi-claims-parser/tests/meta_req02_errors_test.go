// REQ2
package tests

import (
	"regexp"
	"strings"
	"testing"
)

func TestMeta_REQ2_ErrorPathsExist(t *testing.T) {
	content := readTestFile(t, "req02_error_paths_test.go")

	errorPatterns := []struct {
		name    string
		pattern string
	}{
		{"HTTP non-200", `HTTP.*[45]\d\d|Non200|StatusInternalServerError`},
		{"Malformed JSON", `Malformed.*JSON|json\.SyntaxError`},
		{"Corrupt ZIP", `Corrupt.*[Zz]ip|failed to open zip`},
		{"Invalid EDI", `Invalid.*EDI|error message`},
	}

	for _, ep := range errorPatterns {
		t.Run(ep.name, func(t *testing.T) {
			if !regexp.MustCompile(ep.pattern).MatchString(content) {
				t.Errorf("REQ2: Missing error path test for %s", ep.name)
			}
		})
	}
}

func TestMeta_REQ2_ErrorsAsUsage(t *testing.T) {
	content := readTestFile(t, "req02_error_paths_test.go")

	if !strings.Contains(content, "errors.As") {
		t.Error("REQ2: Must use errors.As() for error type validation")
	}

	errorTypes := []string{"json.SyntaxError", "fs.PathError"}
	found := 0
	for _, et := range errorTypes {
		if strings.Contains(content, et) {
			found++
		}
	}
	if found == 0 {
		t.Error("REQ2: Should check specific error types (json.SyntaxError, fs.PathError)")
	}
}

func TestMeta_REQ2_HTTPErrorTests(t *testing.T) {
	content := readTestFile(t, "req02_error_paths_test.go")

	httpTests := countMatches(content, `func Test_ParseClaimEdi_HTTP`)
	if httpTests < 2 {
		t.Errorf("REQ2: Need at least 2 HTTP error tests, found %d", httpTests)
	}
}
