package main

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// Config
const (
	RepoBeforeDir = "repository_before"
	RepoAfterDir  = "repository_after"
	TestsDir      = "tests"
	TestFile      = "worker_pool_test.go"
	ReportsDir    = "evaluation/reports"
)

type TestEvent struct {
	Time    time.Time `json:"Time"`
	Action  string    `json:"Action"`
	Package string    `json:"Package"`
	Test    string    `json:"Test"`
	Elapsed float64   `json:"Elapsed"`
	Output  string    `json:"Output"`
}

type TestSummary struct {
	NumTotalTests  int `json:"numTotalTests"`
	NumPassedTests int `json:"numPassedTests"`
	NumFailedTests int `json:"numFailedTests"`
}

type TestResult struct {
	Passed    bool        `json:"passed"`
	Summary   TestSummary `json:"summary"`
	RawOutput string      `json:"raw_output"`
}

type EnvironmentInfo struct {
	GoVersion string `json:"go_version"`
	Platform  string `json:"platform"`
}

type Comparison struct {
	PassedGate bool `json:"passed_gate"`
}

type EvaluationReport struct {
	RunID       string          `json:"run_id"`
	StartedAt   string          `json:"started_at"`
	FinishedAt  string          `json:"finished_at"`
	Duration    float64         `json:"duration"`
	Environment EnvironmentInfo `json:"environment"`
	Before      *TestResult     `json:"before"`
	After       *TestResult     `json:"after"`
	Comparison  Comparison      `json:"comparison"`
	Success     bool            `json:"success"`
	Error       *string         `json:"error"`
}

func main() {
	exitCode := runMain()
	os.Exit(exitCode)
}

func runMain() int {
	// Ensure reports directory exists
	if err := os.MkdirAll(ReportsDir, 0755); err != nil {
		fmt.Printf("Error creating reports dir: %v\n", err)
		return 1
	}

	report := runEvaluation()

	// Write report
	now := time.Now()
	dateStr := now.Format("2006-01-02")
	timeStr := now.Format("15-04-05")
	reportDir := filepath.Join(ReportsDir, dateStr, timeStr)
	if err := os.MkdirAll(reportDir, 0755); err != nil {
		fmt.Printf("Error creating report subdir: %v\n", err)
		return 1
	}

	reportPath := filepath.Join(reportDir, "report.json")
	file, err := os.Create(reportPath)
	if err != nil {
		fmt.Printf("Error creating report file: %v\n", err)
		return 1
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(report); err != nil {
		fmt.Printf("Error writing report: %v\n", err)
		return 1
	}

	fmt.Printf("Report written to %s\n", reportPath)

	if report.Success {
		return 0
	}
	return 1
}

func runEvaluation() EvaluationReport {
	start := time.Now()
	runID := generateRunID()

	fmt.Println("--- Running Evaluation ---")

	env := EnvironmentInfo{
		GoVersion: runtime.Version(),
		Platform:  fmt.Sprintf("%s-%s", runtime.GOOS, runtime.GOARCH),
	}

	// Copy tests
	if err := copyTestFile(RepoBeforeDir); err != nil {
		errMsg := fmt.Sprintf("Failed to copy tests to before: %v", err)
		return EvaluationReport{RunID: runID, Environment: env, Error: &errMsg}
	}
	if err := copyTestFile(RepoAfterDir); err != nil {
		errMsg := fmt.Sprintf("Failed to copy tests to after: %v", err)
		return EvaluationReport{RunID: runID, Environment: env, Error: &errMsg}
	}

	// 1. Evaluate Before
	fmt.Println("Testing Repository Before...")
	beforeResult := runGoTest(RepoBeforeDir)

	// 2. Evaluate After
	fmt.Println("Testing Repository After...")
	afterResult := runGoTest(RepoAfterDir)

	end := time.Now()

	// Logic: Success if 'After' passes completely
	passedGate := afterResult.Passed
	comparison := Comparison{PassedGate: passedGate}

	return EvaluationReport{
		RunID:       runID,
		StartedAt:   start.Format(time.RFC3339),
		FinishedAt:  end.Format(time.RFC3339),
		Duration:    end.Sub(start).Seconds(),
		Environment: env,
		Before:      &beforeResult,
		After:       &afterResult,
		Comparison:  comparison,
		Success:     comparison.PassedGate,
		Error:       nil,
	}
}

func copyTestFile(targetDir string) error {
	srcPath := filepath.Join(TestsDir, TestFile)
	dstPath := filepath.Join(targetDir, TestFile)

	src, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer src.Close()

	dst, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer dst.Close()

	_, err = io.Copy(dst, src)
	return err
}

func runGoTest(dir string) TestResult {
	// go test -json .
	cmd := exec.Command("go", "test", "-json", ".")
	cmd.Dir = dir

	output, err := cmd.CombinedOutput()
	rawOutput := string(output)

	// Even if err != nil (tests failed), we parse the JSON output
	summary, parseErr := parseGoTestJSON(rawOutput)
	parsed := false
	if parseErr == nil {
		// If we successfully parsed, we can determine pass/fail based on summary
		// However, standard go test fail exit code implies failure.
		// We use summary.NumFailedTests == 0 as the source of truth for "Passed"
		if summary.NumFailedTests == 0 && summary.NumTotalTests > 0 && err == nil {
			parsed = true
		}
		// If err != nil but numFailed == 0, it might be build error or other error
		if err != nil && summary.NumFailedTests == 0 {
			// This is a compilation error or panic before tests started roughly, or mixed output
			// Check if we found any tests.
			parsed = false
		}
	}

	// Truncate raw output if too long
	if len(rawOutput) > 5000 {
		rawOutput = rawOutput[:5000] + "... (truncated)"
	}

	return TestResult{
		Passed:    parsed,
		Summary:   summary,
		RawOutput: rawOutput,
	}
}

func parseGoTestJSON(raw string) (TestSummary, error) {
	summary := TestSummary{}
	scanner := bufio.NewScanner(strings.NewReader(raw))

	// Track tests we've seen to avoid double counting if multiple events emitted
	// Actually 'Action': 'run' starts a test, 'pass'/'fail' ends it.
	// We want to count outcomes.

	seenTests := make(map[string]bool)

	for scanner.Scan() {
		line := scanner.Text()
		var event TestEvent
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			continue // Skip non-JSON lines (build output etc)
		}

		if event.Test != "" {
			// It is a test event
			if event.Action == "pass" {
				if !seenTests[event.Test] {
					summary.NumPassedTests++
					summary.NumTotalTests++
					seenTests[event.Test] = true
				}
			} else if event.Action == "fail" {
				if !seenTests[event.Test] {
					summary.NumFailedTests++
					summary.NumTotalTests++
					seenTests[event.Test] = true
				}
			}
		}
	}

	return summary, nil
}

func generateRunID() string {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		return fmt.Sprintf("run-%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}
