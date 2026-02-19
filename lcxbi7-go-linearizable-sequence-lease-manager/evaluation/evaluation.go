package main

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// --- Structs matching the JSON Schema ---

type Report struct {
	RunID           string                 `json:"run_id"`
	StartedAt       string                 `json:"started_at"`
	FinishedAt      string                 `json:"finished_at"`
	DurationSeconds float64                `json:"duration_seconds"`
	Environment     EnvironmentInfo        `json:"environment"`
	Before          ExecutionResult        `json:"before"`
	After           ExecutionResult        `json:"after"`
	Comparison      ComparisonMetrics      `json:"comparison"`
	Success         bool                   `json:"success"`
	Error           *string                `json:"error"`
}

type EnvironmentInfo struct {
	GoVersion    string `json:"go_version"`
	Platform     string `json:"platform"`
	OS           string `json:"os"`
	Architecture string `json:"architecture"`
	GitCommit    string `json:"git_commit"`
	GitBranch    string `json:"git_branch"`
	Hostname     string `json:"hostname"`
}

type ExecutionResult struct {
	Success  bool             `json:"success"`
	ExitCode int              `json:"exit_code"`
	Tests    []TestDetail     `json:"tests"`
	Metrics  ExecutionSummary `json:"metrics"`
	Output   string           `json:"stdout_snippet"`
}

type TestDetail struct {
	Name    string  `json:"name"`
	Package string  `json:"package"`
	Outcome string  `json:"outcome"`
	Elapsed float64 `json:"elapsed_seconds"`
}

type ExecutionSummary struct {
	Total   int `json:"total"`
	Passed  int `json:"passed"`
	Failed  int `json:"failed"`
	Skipped int `json:"skipped"`
}

type ComparisonMetrics struct {
	BeforeTotal   int  `json:"before_total"`
	AfterTotal    int  `json:"after_total"`
	BeforePassed  int  `json:"before_passed"`
	AfterPassed   int  `json:"after_passed"`
	Regression    bool `json:"regression_detected"`
	Improvement   bool `json:"improvement_detected"`
}

// GoTestEvent represents the JSON output line from 'go test -json'
type GoTestEvent struct {
	Time    time.Time `json:"Time"`
	Action  string    `json:"Action"`
	Package string    `json:"Package"`
	Test    string    `json:"Test"`
	Elapsed float64   `json:"Elapsed"`
	Output  string    `json:"Output"`
}

// --- Helper Functions ---

func generateRunID() string {
	b := make([]byte, 4)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func getGitInfo() (string, string) {
	commit := "unknown"
	branch := "unknown"
	// Best effort to get git info, ignore errors if git is not installed or not a repo
	if out, err := exec.Command("git", "rev-parse", "--short", "HEAD").Output(); err == nil {
		commit = strings.TrimSpace(string(out))
	}
	if out, err := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD").Output(); err == nil {
		branch = strings.TrimSpace(string(out))
	}
	return commit, branch
}

func getEnvironment() EnvironmentInfo {
	hostname, _ := os.Hostname()
	commit, branch := getGitInfo()
	return EnvironmentInfo{
		GoVersion:    runtime.Version(),
		Platform:     fmt.Sprintf("%s-%s", runtime.GOOS, runtime.GOARCH),
		OS:           runtime.GOOS,
		Architecture: runtime.GOARCH,
		GitCommit:    commit,
		GitBranch:    branch,
		Hostname:     hostname,
	}
}

// runGoTests executes 'go test' with specific tags in the target directory
func runGoTests(workDir string, testPath string, tags string, label string) ExecutionResult {
	fmt.Printf("\n%s\nRUNNING TESTS: %s\n%s\n", strings.Repeat("=", 60), label, strings.Repeat("=", 60))
	fmt.Printf("Work Dir: %s\n", workDir)
	fmt.Printf("Tags:     %s\n", tags)

	// Command: go test -json -v -tags=<tags> <testPath>
	args := []string{"test", "-json", "-v"}
	if tags != "" {
		args = append(args, "-tags="+tags)
	}
	args = append(args, testPath)

	cmd := exec.Command("go", args...)
	cmd.Dir = workDir // Set execution context to project root

	// Capture stdout for JSON parsing
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return ExecutionResult{Success: false, Output: "Failed to create stdout pipe: " + err.Error()}
	}

	if err := cmd.Start(); err != nil {
		return ExecutionResult{Success: false, Output: "Failed to start go test: " + err.Error()}
	}

	var tests []TestDetail
	var passed, failed, skipped int
	var outputBuilder strings.Builder

	// Parse the output stream line by line
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := scanner.Bytes()
		var event GoTestEvent

		// Try to parse JSON. If it's not JSON (build errors etc), treat as raw text.
		if jsonErr := json.Unmarshal(line, &event); jsonErr == nil {
			if event.Test != "" {
				// Only track actual test cases, not package summary lines
				if event.Action == "pass" {
					passed++
					tests = append(tests, TestDetail{Name: event.Test, Package: event.Package, Outcome: "passed", Elapsed: event.Elapsed})
					fmt.Printf("  ✅ %s (%.2fs)\n", event.Test, event.Elapsed)
				} else if event.Action == "fail" {
					failed++
					tests = append(tests, TestDetail{Name: event.Test, Package: event.Package, Outcome: "failed", Elapsed: event.Elapsed})
					fmt.Printf("  ❌ %s (%.2fs)\n", event.Test, event.Elapsed)
				} else if event.Action == "skip" {
					skipped++
					tests = append(tests, TestDetail{Name: event.Test, Package: event.Package, Outcome: "skipped", Elapsed: event.Elapsed})
					fmt.Printf("  ⏭️ %s\n", event.Test)
				}
			} else if event.Action == "output" {
				outputBuilder.WriteString(event.Output)
			}
		} else {
			outputBuilder.WriteString(string(line) + "\n")
		}
	}

	err = cmd.Wait()

	exitCode := 0
	success := true
	if err != nil {
		success = false
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = -1
		}
	}

	total := passed + failed + skipped
	fmt.Printf("\nResults: %d passed, %d failed, %d skipped (Total: %d)\n", passed, failed, skipped, total)

	// Truncate output if too long to keep JSON report size manageable
	fullOutput := outputBuilder.String()
	if len(fullOutput) > 10000 {
		fullOutput = fullOutput[len(fullOutput)-10000:]
	}

	return ExecutionResult{
		Success:  success,
		ExitCode: exitCode,
		Tests:    tests,
		Metrics: ExecutionSummary{
			Total:   total,
			Passed:  passed,
			Failed:  failed,
			Skipped: skipped,
		},
		Output: fullOutput,
	}
}

func main() {
	// Flags definition
	outputPath := flag.String("output", "", "Optional: custom path for output JSON report")
	rootDir := flag.String("root", ".", "Project root directory")
	flag.Parse()

	runID := generateRunID()
	startedAt := time.Now()

	fmt.Printf("Evaluation Start | Run ID: %s\n", runID)

	// Resolve absolute path to project root
	absRoot, err := filepath.Abs(*rootDir)
	if err != nil {
		fmt.Printf("Error resolving root path: %v\n", err)
		os.Exit(1)
	}

	// ---------------------------------------------------------
	// 1. Run "Before" Tests (The Flawed/Legacy Implementation)
	// ---------------------------------------------------------
	// We expect these to FAIL.
	beforeRes := runGoTests(absRoot, "./tests/...", "before", "BEFORE (Legacy - Expected to Fail)")

	// ---------------------------------------------------------
	// 2. Run "After" Tests (The Refactored Solution)
	// ---------------------------------------------------------
	// We expect these to PASS.
	afterRes := runGoTests(absRoot, "./tests/...", "after", "AFTER (Refactored - Expected to Pass)")

	finishedAt := time.Now()
	duration := finishedAt.Sub(startedAt).Seconds()

	// ---------------------------------------------------------
	// 3. Comparison & Metrics
	// ---------------------------------------------------------
	comparison := ComparisonMetrics{
		BeforeTotal:  beforeRes.Metrics.Total,
		AfterTotal:   afterRes.Metrics.Total,
		BeforePassed: beforeRes.Metrics.Passed,
		AfterPassed:  afterRes.Metrics.Passed,
		// Regression: If After has failures, that's a regression/failure of the solution
		Regression:   afterRes.Metrics.Failed > 0,
		// Improvement: If After passed more than Before
		Improvement:  afterRes.Metrics.Passed > beforeRes.Metrics.Passed,
	}

	// ---------------------------------------------------------
	// 4. Success Criteria
	// ---------------------------------------------------------
	// The evaluation is successful ONLY if:
	// 1. The 'After' tests executed successfully (exit code 0)
	// 2. There were 0 failures in 'After'
	// 3. At least one test was actually run
	globalSuccess := afterRes.Success && afterRes.Metrics.Failed == 0 && afterRes.Metrics.Total > 0

	var errorMsg *string
	if !globalSuccess {
		msg := "Evaluation Failed: The refactored solution did not pass all tests."
		errorMsg = &msg
	} else {
		// Verify we actually improved things
		if comparison.AfterPassed <= comparison.BeforePassed && comparison.BeforePassed > 0 {
			msg := "Warning: No improvement detected in pass rate."
			fmt.Println(msg)
		}
	}

	// ---------------------------------------------------------
	// 5. Generate Report
	// ---------------------------------------------------------
	report := Report{
		RunID:           runID,
		StartedAt:       startedAt.Format(time.RFC3339),
		FinishedAt:      finishedAt.Format(time.RFC3339),
		DurationSeconds: duration,
		Environment:     getEnvironment(),
		Before:          beforeRes,
		After:           afterRes,
		Comparison:      comparison,
		Success:         globalSuccess,
		Error:           errorMsg,
	}

	// Determine output path
	finalOutput := *outputPath
	if finalOutput == "" {
		// Default structure: evaluation/reports/YYYY-MM-DD/HH-MM-SS/report.json
		dateStr := startedAt.Format("2006-01-02")
		timeStr := startedAt.Format("15-04-05")
		finalOutput = filepath.Join(absRoot, "evaluation", "reports", dateStr, timeStr, "report.json")
	}

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(finalOutput), 0755); err != nil {
		fmt.Printf("Error creating report directory: %v\n", err)
		os.Exit(1)
	}

	file, err := os.Create(finalOutput)
	if err != nil {
		fmt.Printf("Error creating report file: %v\n", err)
		os.Exit(1)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(report); err != nil {
		fmt.Printf("Error encoding report: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("\n%s\nEVALUATION COMPLETE\n%s\n", strings.Repeat("=", 60), strings.Repeat("=", 60))
	fmt.Printf("Global Success: %v\n", globalSuccess)
	fmt.Printf("Report saved to: %s\n", finalOutput)

	if !globalSuccess {
		os.Exit(1)
	}
}