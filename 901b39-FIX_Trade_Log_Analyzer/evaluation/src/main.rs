use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const REPO_BEFORE: &str = "/app/repository_before";
const REPO_AFTER: &str = "/app/repository_after";

#[derive(Default)]
struct RunSummary {
    ok: bool,
    exit_code: i32,
    stdout: String,
}

#[derive(Default)]
struct EvalResult {
    before: RunSummary,
    after: RunSummary,
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let started_at = now_rfc3339_like();

    let mut mode_single: Option<String> = None;
    if args.len() >= 3 && args[1] == "--single" {
        mode_single = Some(args[2].clone());
    }

    let res = if let Some(ref which) = mode_single {
        run_single(which)
    } else {
        run_both()
    };

    let finished_at = now_rfc3339_like();
    if let Err(e) = write_report(&res, &started_at, &finished_at) {
        eprintln!("failed to write report: {e}");
        std::process::exit(2);
    }

    let success = match mode_single.as_deref() {
        Some("before") => !res.before.ok,
        Some("after") => res.after.ok,
        _ => (!res.before.ok) && res.after.ok,
    };

    if success {
        std::process::exit(0);
    } else {
        std::process::exit(1);
    }
}

fn run_single(which: &str) -> EvalResult {
    let mut r = EvalResult::default();
    let override_path = env::var("TEST_REPO_PATH").ok().map(PathBuf::from);
    match which {
        "before" => {
            let p = override_path.as_deref().unwrap_or_else(|| Path::new(REPO_BEFORE));
            r.before = run_repo("before", p);
        }
        "after" => {
            let p = override_path.as_deref().unwrap_or_else(|| Path::new(REPO_AFTER));
            r.after = run_repo("after", p);
        }
        _ => {
            eprintln!("unknown --single mode: {which} (expected before|after)");
        }
    }
    r
}

fn run_both() -> EvalResult {
    let mut r = EvalResult::default();
    r.before = run_repo("before", Path::new(REPO_BEFORE));
    r.after = run_repo("after", Path::new(REPO_AFTER));
    r
}

fn run_repo(label: &str, repo_path: &Path) -> RunSummary {
    println!("============================================================");
    println!("Running evaluation on {label}: {}", repo_path.display());
    println!("============================================================");

    // We generate a temporary harness crate that depends on the target repo by path.
    // This intentionally forces an API contract:
    // - repository_after must compile and pass runtime checks
    // - repository_before is expected to fail (compile error or runtime assertion)
    let tmp = make_tmp_dir(label).unwrap_or_else(|e| {
        eprintln!("failed to create tmp dir: {e}");
        std::process::exit(3);
    });

    if let Err(e) = write_harness(&tmp, repo_path) {
        eprintln!("failed to write harness: {e}");
        return RunSummary {
            ok: false,
            exit_code: 2,
            stdout: format!("harness write error: {e}"),
        };
    }

    let output = run_cmd(
        Command::new("cargo")
            .arg("run")
            .arg("--release")
            .arg("--quiet")
            .current_dir(&tmp),
    );

    let ok = output.status.success();
    let exit_code = output.status.code().unwrap_or(1);
    let stdout = String::from_utf8_lossy(&output.stdout).to_string()
        + &String::from_utf8_lossy(&output.stderr).to_string();

    println!("{stdout}");

    RunSummary {
        ok,
        exit_code,
        stdout,
    }
}

fn write_harness(dir: &Path, repo_path: &Path) -> io::Result<()> {
    fs::create_dir_all(dir.join("src"))?;
    fs::write(dir.join("Cargo.toml"), harness_toml(repo_path))?;
    fs::write(dir.join("src").join("main.rs"), HARNESS_MAIN)?;
    Ok(())
}

fn harness_toml(repo_path: &Path) -> String {
    // Path dependency is fixed at build-time for the harness.
    format!(
        r#"[package]
name = "fix_eval_harness"
version = "0.1.0"
edition = "2021"

[dependencies]
fix_trade_analyzer = {{ path = "{}" }}
"#,
        repo_path.display()
    )
}

fn make_tmp_dir(label: &str) -> io::Result<PathBuf> {
    let mut p = env::temp_dir();
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0))
        .as_nanos();
    p.push(format!("fix_eval_{label}_{nonce}"));
    fs::create_dir_all(&p)?;
    Ok(p)
}

struct CmdOut {
    status: ExitStatus,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

fn run_cmd(cmd: &mut Command) -> CmdOut {
    let out = cmd.output().unwrap_or_else(|e| {
        eprintln!("failed to spawn command: {e}");
        std::process::exit(4);
    });
    CmdOut {
        status: out.status,
        stdout: out.stdout,
        stderr: out.stderr,
    }
}

fn write_report(res: &EvalResult, started_at: &str, finished_at: &str) -> io::Result<()> {
    let report_dir = report_dir()?;
    fs::create_dir_all(&report_dir)?;

    let report_json = build_report_json(res, started_at, finished_at);
    fs::write(report_dir.join("report.json"), report_json.as_bytes())?;

    // convenience pointers
    let latest = Path::new("/app/evaluation/reports/latest.json");
    fs::create_dir_all(latest.parent().unwrap())?;
    fs::write(latest, build_report_json(res, started_at, finished_at).as_bytes())?;

    Ok(())
}

fn report_dir() -> io::Result<PathBuf> {
    // /app/evaluation/reports/YYYY-MM-DD/HH-MM-SS/
    let base = Path::new("/app/evaluation/reports");
    let date = now_date();
    let time = now_time_hms_dash();
    Ok(base.join(date).join(time))
}

fn build_report_json(res: &EvalResult, started_at: &str, finished_at: &str) -> String {
    // Manual JSON: avoids adding serde as an external dependency.
    let run_id = format!(
        "{}-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or(Duration::from_secs(0))
            .as_millis(),
        std::process::id()
    );

    let overall_success = (!res.before.ok) && res.after.ok;

    format!(
        "{{\n  \"run_id\": \"{run_id}\",\n  \"started_at\": \"{started_at}\",\n  \"finished_at\": \"{finished_at}\",\n  \"environment\": {{\n    \"rust_version\": \"{rust_version}\",\n    \"platform\": \"{platform}\"\n  }},\n  \"before\": {{\n    \"tests\": {{\n      \"success\": {before_success},\n      \"exit_code\": {before_exit}\n    }},\n    \"output\": {before_out}\n  }},\n  \"after\": {{\n    \"tests\": {{\n      \"success\": {after_success},\n      \"exit_code\": {after_exit}\n    }},\n    \"output\": {after_out}\n  }},\n  \"success\": {overall_success}\n}}\n",
        rust_version = json_escape(&rust_version()),
        platform = json_escape(&format!("{}-{}", env::consts::OS, env::consts::ARCH)),
        before_success = bool_json(res.before.ok),
        before_exit = res.before.exit_code,
        before_out = json_string(&res.before.stdout),
        after_success = bool_json(res.after.ok),
        after_exit = res.after.exit_code,
        after_out = json_string(&res.after.stdout),
        overall_success = bool_json(overall_success)
    )
}

fn bool_json(v: bool) -> &'static str {
    if v { "true" } else { "false" }
}

fn json_string(s: &str) -> String {
    format!("\"{}\"", json_escape(s))
}

fn json_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 16);
    for ch in s.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => {
                use std::fmt::Write as _;
                let _ = write!(out, "\\u{:04x}", c as u32);
            }
            c => out.push(c),
        }
    }
    out
}

fn rust_version() -> String {
    let out = Command::new("rustc").arg("--version").output();
    match out {
        Ok(o) if o.status.success() => String::from_utf8_lossy(&o.stdout).trim().to_string(),
        _ => "unknown".to_string(),
    }
}

fn now_date() -> String {
    date_cmd(&["-u", "+%F"]).unwrap_or_else(|| {
        let secs = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or(Duration::from_secs(0))
            .as_secs();
        format!("unix-{}", secs / 86_400)
    })
}

fn now_time_hms_dash() -> String {
    date_cmd(&["-u", "+%H-%M-%S"]).unwrap_or_else(|| {
        let ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or(Duration::from_secs(0))
            .as_millis();
        format!("t-{}", ms)
    })
}

fn now_rfc3339_like() -> String {
    date_cmd(&["-u", "+%Y-%m-%dT%H:%M:%SZ"]).unwrap_or_else(|| {
        let ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or(Duration::from_secs(0))
            .as_millis();
        format!("unix_ms_{ms}")
    })
}

fn date_cmd(args: &[&str]) -> Option<String> {
    let out = Command::new("date").args(args).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() { None } else { Some(s) }
}

// The harness is a binary so we can set a global allocator for allocation enforcement.
//
// It performs:
// - escaped delimiter parsing (tag 58 and tag 11)
// - malformed skip behavior
// - microsecond timestamp preservation
// - concurrent report generation during ingestion
// - throughput: 1,000,000 msgs < 3s (release)
// - hot path allocations: zero after warmup
const HARNESS_MAIN: &str = r#"
use fix_trade_analyzer::{parse_fix_timestamp, TradeAnalyzer};
use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Instant;

struct CountingAlloc;
static ALLOC_CALLS: AtomicU64 = AtomicU64::new(0);
static ALLOC_BYTES: AtomicU64 = AtomicU64::new(0);

unsafe impl GlobalAlloc for CountingAlloc {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOC_CALLS.fetch_add(1, Ordering::Relaxed);
        ALLOC_BYTES.fetch_add(layout.size() as u64, Ordering::Relaxed);
        System.alloc(layout)
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        System.dealloc(ptr, layout)
    }
}

#[global_allocator]
static A: CountingAlloc = CountingAlloc;

fn reset_alloc() {
    ALLOC_CALLS.store(0, Ordering::Relaxed);
    ALLOC_BYTES.store(0, Ordering::Relaxed);
}

fn main() {
    let analyzer = TradeAnalyzer::new(16_384, 1 << 20);

    // Escaped pipes in value (58)
    analyzer.process_message(b"8=FIX.4.2|35=D|49=S|56=T|11=ORD001|55=AAPL|54=1|38=100|44=150.25|58=hello\\|world|52=20240115-09:30:00.123456|10=128|").unwrap();

    // Escaped pipes in order id (11)
    analyzer.process_message(b"8=FIX.4.2|35=D|49=S|56=T|11=ORD\\|001|55=AAPL|54=1|38=100|44=150.25|58=ok|52=20240115-09:30:00.123456|10=128|").unwrap();

    // Malformed message must be skipped without crash
    analyzer.process_message_lossy(b"8=FIX.4.2|35=D|49=S|56=T|11ORD001|55=AAPL|54=1|38=100|52=20240115-09:30:00.123456|10=128|", |_e| {});
    assert!(analyzer.malformed_messages() >= 1);

    // Microsecond precision preserved
    let ts = parse_fix_timestamp(b"20240115-09:30:00.123456").unwrap();
    assert_eq!(ts.micros, 123_456);

    // Concurrent report generation during ingestion should not deadlock/block
    let running = std::sync::Arc::new(AtomicBool::new(true));
    let running2 = running.clone();
    let a2 = std::sync::Arc::new(analyzer);
    let a3 = a2.clone();
    let raw = b"8=FIX.4.2|35=D|49=S|56=T|11=ORD001|55=AAPL|54=1|38=100|44=150.25|58=hello\\|world|52=20240115-09:30:00.123456|10=128|";

    let ingest = std::thread::spawn(move || {
        let mut n = 0u64;
        while running2.load(Ordering::Relaxed) && n < 200_000 {
            a3.process_message(raw).unwrap();
            n += 1;
        }
        n
    });

    for _ in 0..200 {
        let _ = a2.report_string();
        std::hint::spin_loop();
    }

    running.store(false, Ordering::Relaxed);
    let processed = ingest.join().unwrap();
    assert!(processed > 0);

    // Allocation-free hot path after warmup
    reset_alloc();
    for _ in 0..200_000 {
        a2.process_message(raw).unwrap();
    }
    let calls = ALLOC_CALLS.load(Ordering::Relaxed);
    assert_eq!(calls, 0, "hot path allocated (calls={}, bytes={})", calls, ALLOC_BYTES.load(Ordering::Relaxed));

    // Throughput: 1,000,000 < 3s (release)
    let start = Instant::now();
    for _ in 0..1_000_000 {
        a2.process_message(raw).unwrap();
    }
    let elapsed = start.elapsed();
    assert!(elapsed.as_secs_f64() < 3.0, "took {:?} for 1,000,000 messages", elapsed);
}
"#;

