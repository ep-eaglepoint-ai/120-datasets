def pytest_report_teststatus(report, config):
    """
    Customize pytest per-test status text.

    This hook returns (category, shortletter, verbose_word).
    By returning custom verbose_word values we replace "PASSED"/"FAILED"
    with "PASS"/"FAIL" in the -v test output.
    """
    # Only change the main test call outcome (avoid altering setup/teardown lines)
    if report.when != "call":
        return None

    if report.passed:
        return ("passed", "P", "PASS")
    if report.failed:
        return ("failed", "F", "FAIL")
    if report.skipped:
        return ("skipped", "s", "SKIP")