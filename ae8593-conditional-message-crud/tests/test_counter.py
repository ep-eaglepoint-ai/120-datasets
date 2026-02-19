import pytest

class Counter:
    def __init__(self):
        self.passed = 0

    def pytest_runtest_logreport(self, report):
        if report.when == 'call' and report.outcome == 'passed':
            self.passed += 1

    def pytest_sessionfinish(self, session, exitstatus):
        print(f"{self.passed} tests passed")

def pytest_configure(config):
    counter = Counter()
    config.pluginmanager.register(counter, "test_counter")