from __future__ import annotations

import json
import os
import platform
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_BEFORE = Path(__file__).resolve().parent.parent / "repository_before"
REPO_AFTER = Path(__file__).resolve().parent.parent / "repository_after"
TESTS_DIR = Path(__file__).resolve().parent.parent / "tests"


@dataclass(frozen=True)
class TestRunResult:
    success: bool
    passed: int
    failed: int
    total: int
    output: str
    return_code: int


def _run_pytest_for_repo(repo_path: Path) -> TestRunResult:
    env = os.environ.copy()
    env["TEST_REPO_PATH"] = str(repo_path)

    proc = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", str(TESTS_DIR)],
        cwd=str(TESTS_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    output = proc.stdout or ""
    passed, failed, total = _parse_pytest_summary(output)
    success = proc.returncode == 0 and failed == 0 and passed > 0

    return TestRunResult(
        success=success,
        passed=passed,
        failed=failed,
        total=total,
        output=output,
        return_code=proc.returncode,
    )


def _parse_pytest_summary(output: str) -> tuple[int, int, int]:
    """
    Parse pytest -q output. We only rely on the final summary lines, e.g.:
      "11 passed in 0.12s"
      "2 failed, 9 passed in 0.18s"
      "1 failed, 1 passed, 1 skipped in 0.20s"
    """
    passed = failed = skipped = 0

    # Most complete form first
    m = re.search(r"(?P<failed>\d+)\s+failed,\s+(?P<passed>\d+)\s+passed(?:,\s+(?P<skipped>\d+)\s+skipped)?\s+in\s+", output)
    if m:
        failed = int(m.group("failed"))
        passed = int(m.group("passed"))
        if m.group("skipped") is not None:
            skipped = int(m.group("skipped"))
        return passed, failed, passed + failed + skipped

    # Passed-only
    m = re.search(r"(?P<passed>\d+)\s+passed\s+in\s+", output)
    if m:
        passed = int(m.group("passed"))
        return passed, 0, passed

    # If parsing fails, report zeros; evaluation still captures raw output.
    return 0, 0, 0


def _analyze_payload(repo_path: Path) -> dict[str, Any]:
    payload_path = repo_path / "rpc-payload.json"
    metrics: dict[str, Any] = {
        "payload_exists": payload_path.exists(),
        "json_parse_ok": False,
        "jsonrpc_is_2_0": False,
        "top_method_is_call": False,
        "params_service_is_object": False,
        "params_method_is_execute": False,
        "args_length": None,
        "execute_args_order_ok": False,
        "mobile_phone": None,
        "mobile_phone_is_international": False,
    }

    if not payload_path.exists():
        return metrics

    try:
        payload = json.loads(payload_path.read_text(encoding="utf-8"))
        metrics["json_parse_ok"] = True
    except Exception:
        return metrics

    try:
        metrics["jsonrpc_is_2_0"] = payload.get("jsonrpc") == "2.0"
        metrics["top_method_is_call"] = payload.get("method") == "call"

        params = payload.get("params", {})
        if isinstance(params, dict):
            metrics["params_service_is_object"] = params.get("service") == "object"
            metrics["params_method_is_execute"] = params.get("method") == "execute"

            args = params.get("args")
            if isinstance(args, list):
                metrics["args_length"] = len(args)
                if len(args) >= 6:
                    db, uid, password, model, method, employee = args[:6]
                    metrics["execute_args_order_ok"] = (
                        isinstance(db, str)
                        and isinstance(uid, int)
                        and isinstance(password, str)
                        and model == "hr.employee"
                        and method == "create"
                        and isinstance(employee, dict)
                    )
                    if isinstance(employee, dict):
                        mobile = employee.get("mobile_phone")
                        metrics["mobile_phone"] = mobile
                        if isinstance(mobile, str):
                            metrics["mobile_phone_is_international"] = bool(re.fullmatch(r"^\+\d{7,15}$", mobile))
    except Exception:
        # Keep metrics best-effort; tests are the correctness gate.
        pass

    return metrics


def _write_report(report: dict[str, Any]) -> Path:
    reports_root = Path(__file__).resolve().parent / "reports"
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H-%M-%S")
    report_dir = reports_root / date_str / time_str
    report_dir.mkdir(parents=True, exist_ok=True)

    report_path = report_dir / "report.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    latest_path = reports_root / "latest.json"
    latest_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    return report_path


def main() -> int:
    started = time.time()
    started_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    before_metrics = _analyze_payload(REPO_BEFORE)
    after_metrics = _analyze_payload(REPO_AFTER)

    before_tests = _run_pytest_for_repo(REPO_BEFORE)
    after_tests = _run_pytest_for_repo(REPO_AFTER)

    finished_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    report: dict[str, Any] = {
        "run_id": f"{int(time.time() * 1000)}",
        "started_at": started_at,
        "finished_at": finished_at,
        "duration_seconds": round(time.time() - started, 6),
        "environment": {
            "python_version": platform.python_version(),
            "platform": f"{platform.system()}-{platform.machine()}",
        },
        "before": {
            "metrics": before_metrics,
            "tests": {
                "passed": before_tests.passed,
                "failed": before_tests.failed,
                "total": before_tests.total,
                "success": before_tests.success,
                "return_code": before_tests.return_code,
                "output": before_tests.output,
            },
        },
        "after": {
            "metrics": after_metrics,
            "tests": {
                "passed": after_tests.passed,
                "failed": after_tests.failed,
                "total": after_tests.total,
                "success": after_tests.success,
                "return_code": after_tests.return_code,
                "output": after_tests.output,
            },
        },
        "comparison": {
            "before_tests_success": before_tests.success,
            "after_tests_success": after_tests.success,
            "tests_fixed": after_tests.passed - before_tests.passed,
            "args_order_fixed": (not before_metrics.get("execute_args_order_ok")) and bool(after_metrics.get("execute_args_order_ok")),
            "mobile_phone_fixed": (not before_metrics.get("mobile_phone_is_international")) and bool(after_metrics.get("mobile_phone_is_international")),
        },
        "success": (not before_tests.success) and after_tests.success,
        "error": None,
    }

    if not report["success"]:
        report["error"] = "After implementation tests did not pass"

    report_path = _write_report(report)

    print("=" * 60)
    print("Odoo JSON-RPC Employee Payload Evaluation")
    print("=" * 60)
    print(f"Report: {report_path}")
    print(f"Overall Success: {report['success']}")
    print("\nBefore:")
    print(f"  - Tests: {before_tests.passed} passed, {before_tests.failed} failed (rc={before_tests.return_code})")
    print(f"  - Args order ok: {before_metrics.get('execute_args_order_ok')}")
    print(f"  - Mobile international: {before_metrics.get('mobile_phone_is_international')}")
    print("\nAfter:")
    print(f"  - Tests: {after_tests.passed} passed, {after_tests.failed} failed (rc={after_tests.return_code})")
    print(f"  - Args order ok: {after_metrics.get('execute_args_order_ok')}")
    print(f"  - Mobile international: {after_metrics.get('mobile_phone_is_international')}")

    return 0 if report["success"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
