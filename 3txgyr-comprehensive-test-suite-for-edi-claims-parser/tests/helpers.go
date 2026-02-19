package tests

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func testFilesDir(t *testing.T) string {
	t.Helper()

	// Get repo path from environment variable
	repoPath := os.Getenv("REPO_PATH")
	if repoPath == "" {
		repoPath = "repository_after" // Default
	}

	// Try various base paths
	candidates := []string{
		"../" + repoPath,
		repoPath,
		"/app/" + repoPath,
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}

	// Try to find from current working directory
	cwd, _ := os.Getwd()
	for d := cwd; d != filepath.Dir(d); d = filepath.Dir(d) {
		candidate := filepath.Join(d, repoPath)
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}

	t.Fatalf("%s not found (set REPO_PATH env var)", repoPath)
	return ""
}

// readTestFile reads a test file from repository_after/
func readTestFile(t *testing.T, filename string) string {
	t.Helper()
	dir := testFilesDir(t)
	path := filepath.Join(dir, filename)
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("Failed to read %s: %v", filename, err)
	}
	return string(data)
}

// readAllTestFiles reads all test files and returns concatenated content
func readAllTestFiles(t *testing.T) string {
	t.Helper()
	dir := testFilesDir(t)
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("Failed to read test directory: %v", err)
	}

	var content strings.Builder
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), "_test.go") || strings.HasSuffix(e.Name(), ".go") {
			data, err := os.ReadFile(filepath.Join(dir, e.Name()))
			if err == nil {
				content.WriteString(string(data))
				content.WriteString("\n")
			}
		}
	}
	return content.String()
}

// countMatches counts regex matches in content
func countMatches(content, pattern string) int {
	re := regexp.MustCompile(pattern)
	return len(re.FindAllString(content, -1))
}
