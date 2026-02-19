package tests

import (
	"regexp"
	"strings"
	"testing"
)

func TestMeta_REQ9_FuzzTestsExist(t *testing.T) {
	content := readTestFile(t, "req09_fuzz_test.go")

	fuzzTests := countMatches(content, `func Fuzz_`)
	if fuzzTests < 3 {
		t.Errorf("REQ9: Need at least 3 fuzz tests, found %d", fuzzTests)
	}
	t.Logf("REQ9: Found %d fuzz tests", fuzzTests)
}

func TestMeta_REQ9_FuzzTargets(t *testing.T) {
	content := readTestFile(t, "req09_fuzz_test.go")

	targets := []struct {
		name    string
		pattern string
	}{
		{"Random EDI", `Fuzz_.*EDI|Fuzz_MapSegments`},
		{"Corrupt ZIP", `Fuzz_.*ZIP|Fuzz_.*Corrupt`},
		{"Malformed JSON", `Fuzz_.*JSON|Fuzz_.*Malformed`},
	}

	for _, target := range targets {
		t.Run(target.name, func(t *testing.T) {
			if !regexp.MustCompile(target.pattern).MatchString(content) {
				t.Errorf("REQ9: Missing fuzz test for %s", target.name)
			}
		})
	}
}

func TestMeta_REQ9_FuzzSeedCorpus(t *testing.T) {
	content := readTestFile(t, "req09_fuzz_test.go")

	if !strings.Contains(content, "f.Add(") {
		t.Error("REQ9: Fuzz tests should have seed corpus using f.Add()")
	}

	if !strings.Contains(content, "f.Fuzz(func(t *testing.T") {
		t.Error("REQ9: Fuzz tests must implement f.Fuzz()")
	}
}
