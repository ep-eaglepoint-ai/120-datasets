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

// --- Structs matching the requested JSON Schema ---

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
	Success  bool                   `json:"success"`
	ExitCode int                    `json:"exit_code"`
	Tests    []TestDetail           `json:"tests"`
	Metrics  ExecutionSummary       `json:"metrics"`
	Output   string                 `json:"stdout_snippet"`
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
	fmt.Printf("Target:   %s\n", testPath)

	// Build arguments: go test -json -tags=<tags> <testPath>
	args := []string{"test", "-json"}
	if tags != "" {
		args = append(args, "-tags="+tags)
	}
	args = append(args, testPath)

	cmd := exec.Command("go", args...)
	cmd.Dir = workDir

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

	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := scanner.Bytes()
		var event GoTestEvent
		if jsonErr := json.Unmarshal(line, &event); jsonErr == nil {
			if event.Test != "" {
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

	fullOutput := outputBuilder.String()
	if len(fullOutput) > 5000 {
		fullOutput = fullOutput[len(fullOutput)-5000:]
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
	outputPath := flag.String("output", "", "Output JSON file path")
	rootDir := flag.String("root", "..", "Project root directory relative to this script")
	flag.Parse()

	runID := generateRunID()
	startedAt := time.Now()

	fmt.Printf("Run ID: %s\n", runID)

	absRoot, _ := filepath.Abs(*rootDir)

	// --- CRITICAL CHANGES HERE ---
	// 1. We run from the Project Root (absRoot)
	// 2. We target "./tests/..."
	// 3. We pass the specific tag ("before" or "after")

	// Run "Before" Tests
	beforeRes := runGoTests(absRoot, "./tests/...", "before", "BEFORE (Legacy)")

	// Run "After" Tests
	afterRes := runGoTests(absRoot, "./tests/...", "after", "AFTER (Refactored)")

	finishedAt := time.Now()
	duration := finishedAt.Sub(startedAt).Seconds()

	// Comparison Logic
	comparison := ComparisonMetrics{
		BeforeTotal:  beforeRes.Metrics.Total,
		AfterTotal:   afterRes.Metrics.Total,
		BeforePassed: beforeRes.Metrics.Passed,
		AfterPassed:  afterRes.Metrics.Passed,
		Regression:   afterRes.Metrics.Failed > 0,
		Improvement:  afterRes.Metrics.Passed > beforeRes.Metrics.Passed,
	}

	// Success: After tests must pass, and we must have run at least 1 test.
	globalSuccess := afterRes.Success && afterRes.Metrics.Failed == 0 && afterRes.Metrics.Total > 0
	var errorMsg *string
	if !globalSuccess {
		msg := "Refactored implementation failed tests or ran zero tests."
		errorMsg = &msg
	}

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

	finalOutput := *outputPath
	if finalOutput == "" {
		dateStr := startedAt.Format("2006-01-02")
		timeStr := startedAt.Format("15-04-05")
		finalOutput = filepath.Join(absRoot, "evaluation", "reports", dateStr, timeStr, "report.json")
	}

	os.MkdirAll(filepath.Dir(finalOutput), 0755)

	file, err := os.Create(finalOutput)
	if err != nil {
		fmt.Printf("Error creating report file: %v\n", err)
		os.Exit(1)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	encoder.Encode(report)

	fmt.Printf("\nReport saved to: %s\n", finalOutput)
	if !globalSuccess {
		os.Exit(1)
	}
}