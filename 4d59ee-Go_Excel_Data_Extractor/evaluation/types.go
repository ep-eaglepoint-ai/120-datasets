package main

type TestResult struct {
	NodeID  string `json:"nodeid"`
	Name    string `json:"name"`
	Outcome string `json:"outcome"`
}

type TestSummary struct {
	Total   int `json:"total"`
	Passed  int `json:"passed"`
	Failed  int `json:"failed"`
	Skipped int `json:"skipped"`
}

type TestRunResult struct {
	Success  bool         `json:"success"`
	ExitCode int          `json:"exit_code"`
	Tests    []TestResult `json:"tests"`
	Summary  TestSummary  `json:"summary"`
	Stdout   string       `json:"stdout"`
	Stderr   string       `json:"stderr"`
}

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

type Report struct {
	RunID           string      `json:"run_id"`
	StartedAt       string      `json:"started_at"`
	FinishedAt      string      `json:"finished_at"`
	DurationSeconds float64     `json:"duration_seconds"`
	Success         bool        `json:"success"`
	Error           *string     `json:"error"`
	Environment     Environment `json:"environment"`
	Results         *Results    `json:"results,omitempty"`
}

type Results struct {
	Before     TestRunResult `json:"before"`
	After      TestRunResult `json:"after"`
	Comparison Comparison    `json:"comparison"`
}
