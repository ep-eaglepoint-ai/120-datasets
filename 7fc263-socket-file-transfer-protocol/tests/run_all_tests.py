#!/usr/bin/env python3
"""
Test Runner for File Transfer System
Runs all test suites and generates a comprehensive report.
"""

import unittest
import sys
import os
import time
from io import StringIO

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Import test modules
import test_file_transfer
import test_performance
import test_error_handling


class TestResult:
    """Custom test result class to capture detailed information"""
    
    def __init__(self):
        self.tests_run = 0
        self.failures = []
        self.errors = []
        self.skipped = []
        self.successes = []
        self.start_time = None
        self.end_time = None
    
    def start_test(self, test):
        """Called when a test starts"""
        if self.start_time is None:
            self.start_time = time.time()
    
    def add_success(self, test):
        """Called when a test passes"""
        self.tests_run += 1
        self.successes.append(test)
    
    def add_error(self, test, err):
        """Called when a test has an error"""
        self.tests_run += 1
        self.errors.append((test, err))
    
    def add_failure(self, test, err):
        """Called when a test fails"""
        self.tests_run += 1
        self.failures.append((test, err))
    
    def add_skip(self, test, reason):
        """Called when a test is skipped"""
        self.tests_run += 1
        self.skipped.append((test, reason))
    
    def stop_test(self, test):
        """Called when a test ends"""
        self.end_time = time.time()


def run_test_suite(test_module, suite_name):
    """Run a specific test suite and return results"""
    print(f"\n{'='*60}")
    print(f"Running {suite_name}")
    print(f"{'='*60}")
    
    # Create test suite
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromModule(test_module)
    
    # Run tests with custom result collector
    stream = StringIO()
    runner = unittest.TextTestRunner(
        stream=stream,
        verbosity=2,
        buffer=True
    )
    
    start_time = time.time()
    result = runner.run(suite)
    end_time = time.time()
    
    # Print results
    output = stream.getvalue()
    print(output)
    
    # Return summary
    return {
        'name': suite_name,
        'tests_run': result.testsRun,
        'failures': len(result.failures),
        'errors': len(result.errors),
        'skipped': len(result.skipped),
        'success_rate': ((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100) if result.testsRun > 0 else 0,
        'duration': end_time - start_time,
        'details': result
    }


def print_summary_report(results):
    """Print a comprehensive summary report"""
    print(f"\n{'='*80}")
    print("TEST SUMMARY REPORT")
    print(f"{'='*80}")
    
    total_tests = sum(r['tests_run'] for r in results)
    total_failures = sum(r['failures'] for r in results)
    total_errors = sum(r['errors'] for r in results)
    total_skipped = sum(r['skipped'] for r in results)
    total_passed = total_tests - total_failures - total_errors - total_skipped
    total_duration = sum(r['duration'] for r in results)
    
    print(f"\nOverall Results:")
    print(f"  Total Tests:    {total_tests}")
    print(f"  Passed:         {total_passed}")
    print(f"  Failed:         {total_failures}")
    print(f"  Errors:         {total_errors}")
    print(f"  Skipped:        {total_skipped}")
    print(f"  Success Rate:   {(total_passed/total_tests*100):.1f}%" if total_tests > 0 else "  Success Rate:   N/A")
    print(f"  Total Duration: {total_duration:.2f}s")
    
    print(f"\nPer-Suite Results:")
    print(f"{'Suite':<25} {'Tests':<8} {'Pass':<8} {'Fail':<8} {'Error':<8} {'Skip':<8} {'Rate':<8} {'Time':<8}")
    print(f"{'-'*25} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*8}")
    
    for result in results:
        passed = result['tests_run'] - result['failures'] - result['errors'] - result['skipped']
        print(f"{result['name']:<25} {result['tests_run']:<8} {passed:<8} {result['failures']:<8} "
              f"{result['errors']:<8} {result['skipped']:<8} {result['success_rate']:<7.1f}% {result['duration']:<7.2f}s")
    
    # Print detailed failure information
    if total_failures > 0 or total_errors > 0:
        print(f"\n{'='*80}")
        print("DETAILED FAILURE/ERROR REPORT")
        print(f"{'='*80}")
        
        for result in results:
            if result['failures'] > 0 or result['errors'] > 0:
                print(f"\n{result['name']} Issues:")
                print(f"{'-'*40}")
                
                # Print failures
                for test, traceback in result['details'].failures:
                    print(f"FAILURE: {test}")
                    print(f"  {traceback.strip()}")
                    print()
                
                # Print errors
                for test, traceback in result['details'].errors:
                    print(f"ERROR: {test}")
                    print(f"  {traceback.strip()}")
                    print()
    
    # Final verdict
    print(f"\n{'='*80}")
    if total_failures == 0 and total_errors == 0:
        print("🎉 ALL TESTS PASSED! 🎉")
        print("The file transfer system is working correctly.")
    else:
        print("❌ SOME TESTS FAILED")
        print(f"Please review the {total_failures + total_errors} failed/error tests above.")
    print(f"{'='*80}")


def main():
    """Main test runner function"""
    print("File Transfer System - Comprehensive Test Suite")
    print("=" * 80)
    
    # Check if required dependencies are available
    try:
        import psutil
        performance_tests_available = True
    except ImportError:
        print("Warning: psutil not available, some performance tests will be skipped")
        performance_tests_available = False
    
    # Define test suites to run
    test_suites = [
        (test_file_transfer, "Core Functionality Tests"),
        (test_error_handling, "Error Handling Tests"),
    ]
    
    # Add performance tests if dependencies are available
    if performance_tests_available:
        test_suites.append((test_performance, "Performance Tests"))
    
    # Run all test suites
    results = []
    overall_start_time = time.time()
    
    for test_module, suite_name in test_suites:
        try:
            result = run_test_suite(test_module, suite_name)
            results.append(result)
        except Exception as e:
            print(f"Error running {suite_name}: {e}")
            results.append({
                'name': suite_name,
                'tests_run': 0,
                'failures': 0,
                'errors': 1,
                'skipped': 0,
                'success_rate': 0,
                'duration': 0,
                'details': None
            })
    
    overall_end_time = time.time()
    
    # Print comprehensive summary
    print_summary_report(results)
    
    print(f"\nTotal execution time: {overall_end_time - overall_start_time:.2f}s")
    
    # Return exit code based on results
    total_failures = sum(r['failures'] for r in results)
    total_errors = sum(r['errors'] for r in results)
    
    if total_failures > 0 or total_errors > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == '__main__':
    main()