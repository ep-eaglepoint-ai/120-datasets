// Package main runs meta tests against repository_before and repository_after
// and generates a report.json with detailed test results.
package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"
)

// TestCase represents a single test result
type TestCase struct {
	NodeID  string `json:"nodeid"`
	Name    string `json:"name"`
	Outcome string `json:"outcome"`
}

// Summary represents test summary counts
type Summary struct {
	Total   int `json:"total"`
	Passed  int `json:"passed"`
	Failed  int `json:"failed"`
	Errors  int `json:"errors"`
	Skipped int `json:"skipped"`
}

// RepoResult represents results for a single repository
type RepoResult struct {
	Success  bool       `json:"success"`
	ExitCode int        `json:"exit_code"`
	Tests    []TestCase `json:"tests"`
	Summary  Summary    `json:"summary"`
	Stdout   string     `json:"stdout"`
	Stderr   string     `json:"stderr"`
}

// Comparison represents the comparison between before and after
type Comparison struct {
	BeforeTestsPassed bool `json:"before_tests_passed"`
	AfterTestsPassed  bool `json:"after_tests_passed"`
	BeforeTotal       int  `json:"before_total"`
	BeforePassed      int  `json:"before_passed"`
	BeforeFailed      int  `json:"before_failed"`
	AfterTotal        int  `json:"after_total"`
	AfterPassed       int  `json:"after_passed"`
	AfterFailed       int  `json:"after_failed"`
}

// Results contains both repo results and comparison
type Results struct {
	Before     RepoResult `json:"before"`
	After      RepoResult `json:"after"`
	Comparison Comparison `json:"comparison"`
}

// Environment contains runtime environment info
type Environment struct {
	GoVersion    string `json:"go_version"`
	Platform     string `json:"platform"`
	OS           string `json:"os"`
	OSRelease    string `json:"os_release"`
	Architecture string `json:"architecture"`
	Hostname     string `json:"hostname"`
	GitCommit    string `json:"git_commit"`
	GitBranch    string `json:"git_branch"`
}

// Report is the main report structure
type Report struct {
	RunID           string      `json:"run_id"`
	StartedAt       string      `json:"started_at"`
	FinishedAt      string      `json:"finished_at"`
	DurationSeconds float64     `json:"duration_seconds"`
	Success         bool        `json:"success"`
	Error           *string     `json:"error"`
	Environment     Environment `json:"environment"`
	Results         Results     `json:"results"`
}

func main() {
	// If an argument is provided (e.g. "single"), run meta tests only for REPO_PATH
	if len(os.Args) > 1 && os.Args[1] == "single" {
		repoPath := os.Getenv("REPO_PATH")
		if repoPath == "" {
			repoPath = "repository_after"
		}

		fmt.Println("=" + strings.Repeat("=", 79))
		fmt.Println("EDI CLAIMS PARSER - META TESTS")
		fmt.Printf("Target repo: %s\n", repoPath)
		fmt.Println("=" + strings.Repeat("=", 79))
		fmt.Println()

		result := runMetaTests(repoPath)
		printResult(repoPath, result)

		// For single-repo runs:
		// - We still show accurate pass/fail in the console output.
		// - We deliberately do NOT fail the process when running against
		//   repository_before, because that repo is expected to fail and
		//   callers (like CI wrappers) treat any non-zero exit as a hard error.
		// - For other repos (e.g. repository_after), keep failing on meta
		//   test failures so they surface as proper errors.
		if !result.Success && repoPath != "repository_before" {
			os.Exit(1)
		}
		return
	}

	// Default mode: full evaluation (before + after + report.json)
	startTime := time.Now()

	runID := generateRunID()

	fmt.Println("=" + strings.Repeat("=", 79))
	fmt.Println("EDI CLAIMS PARSER - META TEST EVALUATION")
	fmt.Printf("Run ID: %s\n", runID)
	fmt.Println("=" + strings.Repeat("=", 79))
	fmt.Println()

	fmt.Println("Running meta tests against: repository_before")
	fmt.Println("-" + strings.Repeat("-", 79))
	beforeResult := runMetaTests("repository_before")
	printResult("repository_before", beforeResult)

	fmt.Println()
	fmt.Println("Running meta tests against: repository_after")
	fmt.Println("-" + strings.Repeat("-", 79))
	afterResult := runMetaTests("repository_after")
	printResult("repository_after", afterResult)

	endTime := time.Now()
	duration := endTime.Sub(startTime).Seconds()

	comparison := Comparison{
		BeforeTestsPassed: beforeResult.Success,
		AfterTestsPassed:  afterResult.Success,
		BeforeTotal:       beforeResult.Summary.Total,
		BeforePassed:      beforeResult.Summary.Passed,
		BeforeFailed:      beforeResult.Summary.Failed,
		AfterTotal:        afterResult.Summary.Total,
		AfterPassed:       afterResult.Summary.Passed,
		AfterFailed:       afterResult.Summary.Failed,
	}

	overallSuccess := !beforeResult.Success && afterResult.Success

	report := Report{
		RunID:           runID,
		StartedAt:       startTime.Format("2006-01-02T15:04:05.000000"),
		FinishedAt:      endTime.Format("2006-01-02T15:04:05.000000"),
		DurationSeconds: duration,
		Success:         overallSuccess,
		Error:           nil,
		Environment:     getEnvironment(),
		Results: Results{
			Before:     beforeResult,
			After:      afterResult,
			Comparison: comparison,
		},
	}

	saveReport(report)

	fmt.Println()
	fmt.Println("=" + strings.Repeat("=", 79))
	fmt.Println("EVALUATION SUMMARY")
	fmt.Println("=" + strings.Repeat("=", 79))
	fmt.Printf("\nrepository_before: %d passed, %d failed (expected to fail)\n",
		beforeResult.Summary.Passed, beforeResult.Summary.Failed)
	fmt.Printf("repository_after:  %d passed, %d failed (expected to pass)\n",
		afterResult.Summary.Passed, afterResult.Summary.Failed)
	fmt.Printf("\nDuration: %.3f seconds\n", duration)

	fmt.Println()
	if overallSuccess {
		fmt.Println("✓ EVALUATION PASSED")
		fmt.Println("  - repository_before: FAILED as expected (no test files)")
		fmt.Println("  - repository_after:  PASSED as expected (has test files)")
	} else {
		fmt.Println("✗ EVALUATION FAILED")
		if beforeResult.Success {
			fmt.Println("  - repository_before should FAIL but passed")
		}
		if !afterResult.Success {
			fmt.Println("  - repository_after should PASS but failed")
		}
	}

	fmt.Println()
	if !overallSuccess {
		os.Exit(1)
	}
}

func generateRunID() string {
	b := make([]byte, 4)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func getEnvironment() Environment {
	hostname, _ := os.Hostname()

	// Get OS release
	osRelease := "unknown"
	if data, err := os.ReadFile("/etc/os-release"); err == nil {
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "VERSION_ID=") {
				osRelease = strings.Trim(strings.TrimPrefix(line, "VERSION_ID="), "\"")
				break
			}
		}
	}

	// Get git info
	gitCommit := "unknown"
	gitBranch := "unknown"
	if out, err := exec.Command("git", "rev-parse", "--short", "HEAD").Output(); err == nil {
		gitCommit = strings.TrimSpace(string(out))
	}
	if out, err := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD").Output(); err == nil {
		gitBranch = strings.TrimSpace(string(out))
	}

	return Environment{
		GoVersion:    runtime.Version(),
		Platform:     fmt.Sprintf("%s-%s", runtime.GOOS, runtime.GOARCH),
		OS:           runtime.GOOS,
		OSRelease:    osRelease,
		Architecture: runtime.GOARCH,
		Hostname:     hostname,
		GitCommit:    gitCommit,
		GitBranch:    gitBranch,
	}
}

func runMetaTests(repoPath string) RepoResult {
	result := RepoResult{
		Tests:   []TestCase{},
		Summary: Summary{},
	}

	// Run go test with verbose output
	cmd := exec.Command("go", "test", "-v", "./...")
	cmd.Dir = "/app/tests"
	cmd.Env = append(os.Environ(), "REPO_PATH="+repoPath)

	stdout, _ := cmd.Output()
	result.Stdout = string(stdout)

	// Get exit code
	if cmd.ProcessState != nil {
		result.ExitCode = cmd.ProcessState.ExitCode()
	}

	// Parse test results
	parseTestOutput(&result, repoPath)

	// Determine success
	result.Success = result.Summary.Failed == 0 && result.Summary.Errors == 0

	return result
}

func parseTestOutput(result *RepoResult, repoPath string) {
	lines := strings.Split(result.Stdout, "\n")

	// Patterns to match Go test output
	passPattern := regexp.MustCompile(`^--- PASS: (\S+)`)
	failPattern := regexp.MustCompile(`^--- FAIL: (\S+)`)
	skipPattern := regexp.MustCompile(`^--- SKIP: (\S+)`)

	for _, line := range lines {
		var testCase TestCase

		if matches := passPattern.FindStringSubmatch(line); len(matches) > 1 {
			testCase = TestCase{
				NodeID:  fmt.Sprintf("tests/%s", matches[1]),
				Name:    matches[1],
				Outcome: "passed",
			}
			result.Tests = append(result.Tests, testCase)
			result.Summary.Passed++
			result.Summary.Total++
		} else if matches := failPattern.FindStringSubmatch(line); len(matches) > 1 {
			testCase = TestCase{
				NodeID:  fmt.Sprintf("tests/%s", matches[1]),
				Name:    matches[1],
				Outcome: "failed",
			}
			result.Tests = append(result.Tests, testCase)
			result.Summary.Failed++
			result.Summary.Total++
		} else if matches := skipPattern.FindStringSubmatch(line); len(matches) > 1 {
			testCase = TestCase{
				NodeID:  fmt.Sprintf("tests/%s", matches[1]),
				Name:    matches[1],
				Outcome: "skipped",
			}
			result.Tests = append(result.Tests, testCase)
			result.Summary.Skipped++
			result.Summary.Total++
		}
	}

	// Check for panic/error patterns
	if strings.Contains(result.Stdout, "panic:") || strings.Contains(result.Stdout, "FAIL\t") {
		if result.Summary.Total == 0 {
			// No tests parsed but there was a failure - likely a compile/runtime error
			result.Summary.Errors = 1
			result.Summary.Total = 1
		}
	}
}

func printResult(repoPath string, result RepoResult) {
	// Print pytest-style output
	for _, t := range result.Tests {
		status := "PASSED"
		symbol := "✓"
		if t.Outcome == "failed" {
			status = "FAILED"
			symbol = "✗"
		} else if t.Outcome == "skipped" {
			status = "SKIPPED"
			symbol = "-"
		}
		fmt.Printf("  %s %s %s\n", symbol, status, t.Name)
	}

	if len(result.Tests) == 0 {
		fmt.Println("  (no tests found or tests failed to run)")
	}

	fmt.Println()
	fmt.Println(strings.Repeat("-", 80))

	// Summary line (pytest style)
	parts := []string{}
	if result.Summary.Passed > 0 {
		parts = append(parts, fmt.Sprintf("%d passed", result.Summary.Passed))
	}
	if result.Summary.Failed > 0 {
		parts = append(parts, fmt.Sprintf("%d failed", result.Summary.Failed))
	}
	if result.Summary.Skipped > 0 {
		parts = append(parts, fmt.Sprintf("%d skipped", result.Summary.Skipped))
	}
	if result.Summary.Errors > 0 {
		parts = append(parts, fmt.Sprintf("%d errors", result.Summary.Errors))
	}

	if len(parts) > 0 {
		fmt.Printf("  %s\n", strings.Join(parts, ", "))
	} else {
		fmt.Println("  0 tests collected")
	}
}

func saveReport(report Report) {
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		fmt.Printf("Error marshaling report: %v\n", err)
		return
	}

	// Save under date/time-based directory:
	//   evaluation/YY-MM-DD/hr-m-s/report.json
	now := time.Now()
	dateDir := now.Format("06-01-02")
	timeDir := now.Format("15-04-05")
	baseDir := "/app/evaluation"
	dirPath := filepath.Join(baseDir, dateDir, timeDir)

	if err := os.MkdirAll(dirPath, 0755); err != nil {
		fmt.Printf("Error creating report directory %s: %v\n", dirPath, err)
		return
	}

	path := filepath.Join(dirPath, "report.json")
	if err := os.WriteFile(path, data, 0644); err != nil {
		fmt.Printf("Error writing report: %v\n", err)
	} else {
		fmt.Printf("Report saved to: %s\n", path)
	}
}
