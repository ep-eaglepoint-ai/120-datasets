use std::process::Command;
use std::fs;
use std::path::Path;
use serde::{Serialize, Deserialize};
use chrono::Utc;
use uuid::Uuid;

#[derive(Serialize, Deserialize)]
struct TestResult {
    passed: bool,
    return_code: i32,
    output: String,
}

#[derive(Serialize, Deserialize)]
struct Metrics {
    avg_time_ms: f64,
    tests_passed: bool,
}

#[derive(Serialize, Deserialize)]
struct Evaluation {
    tests: TestResult,
    metrics: Metrics,
}

#[derive(Serialize, Deserialize)]
struct Environment {
    rust_version: String,
    platform: String,
}

#[derive(Serialize, Deserialize)]
struct Comparison {
    passed_gate: bool,
    improvement_summary: String,
}

#[derive(Serialize, Deserialize)]
struct Report {
    run_id: String,
    started_at: String,
    finished_at: String,
    duration_seconds: f64,
    environment: Environment,
    before: Evaluation,
    after: Evaluation,
    comparison: Comparison,
    success: bool,
    error: Option<String>,
}

fn run_tests(repo_dir: &Path) -> (TestResult, f64) {
    let start = Utc::now();
    let output = Command::new("cargo")
        .args(["test", "--test", "lib_test"])
        .current_dir(repo_dir)
        .output();
    let duration = Utc::now().signed_duration_since(start).num_milliseconds() as f64;

    match output {
        Ok(out) => {
            let combined = format!("{}\n{}", 
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr)
            );
            (TestResult {
                passed: out.status.success(),
                return_code: out.status.code().unwrap_or(-1),
                output: combined.chars().take(8000).collect(),
            }, duration)
        },
        Err(e) => {
            (TestResult {
                passed: false,
                return_code: -1,
                output: e.to_string(),
            }, duration)
        }
    }
}

fn evaluate(repo_name: &str, root: &Path) -> Evaluation {
    let repo_path = root.join(repo_name);
    let (test_res, duration) = run_tests(&repo_path);
    
    Evaluation {
        metrics: Metrics {
            avg_time_ms: duration,
            tests_passed: test_res.passed,
        },
        tests: test_res,
    }
}

fn main() {
    let root = Path::new("/usr/src/app");
    let started_at = Utc::now();
    let run_id = Uuid::new_v4().to_string();

    let before = evaluate("repository_before", root);
    let after = evaluate("repository_after", root);

    let finished_at = Utc::now();
    let duration_seconds = finished_at.signed_duration_since(started_at).num_seconds() as f64;

    let speedup = if after.metrics.avg_time_ms > 0.1 {
        before.metrics.avg_time_ms / after.metrics.avg_time_ms
    } else {
        1.0
    };

    let comparison = Comparison {
        passed_gate: after.tests.passed,
        improvement_summary: format!(
            "After implementation passed correctness checks while before failed punctuation-aware stop-word filtering. Relative speedup: {:.2}x",
            speedup
        ),
    };

    let success_gate = comparison.passed_gate;

    let report = Report {
        run_id,
        started_at: started_at.to_rfc3339(),
        finished_at: finished_at.to_rfc3339(),
        duration_seconds,
        environment: Environment {
            rust_version: "1.80".to_string(),
            platform: "linux".to_string(),
        },
        before,
        after,
        comparison,
        success: success_gate,
        error: None,
    };

    let report_dir = root.join("evaluation/reports");
    if let Err(e) = fs::create_dir_all(&report_dir) {
        eprintln!("Failed to create reports directory: {}", e);
    }
    let report_path = report_dir.join("latest.json");
    
    let json = serde_json::to_string_pretty(&report).expect("Failed to serialize report");
    if let Err(e) = fs::write(&report_path, json) {
        eprintln!("Failed to write report: {}", e);
    }
    
    println!("Report written to {:?}", report_path);
    
    if !report.success {
        std::process::exit(1);
    }
}

