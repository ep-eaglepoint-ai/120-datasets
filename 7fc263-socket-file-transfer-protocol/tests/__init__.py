"""
File Transfer System Test Suite

This package contains comprehensive tests for the file transfer system,
including functionality tests, performance tests, and error handling tests.

Test Modules:
- test_file_transfer: Core functionality tests
- test_performance: Performance and load tests  
- test_error_handling: Error condition tests
- test_config: Test utilities and configuration

Usage:
    # Run all tests
    python -m tests.run_all_tests
    
    # Run specific test module
    python -m unittest tests.test_file_transfer
    python -m unittest tests.test_performance
    python -m unittest tests.test_error_handling
    
    # Run specific test class
    python -m unittest tests.test_file_transfer.TestFileTransferSystem
    
    # Run specific test method
    python -m unittest tests.test_file_transfer.TestFileTransferSystem.test_small_file_transfer
"""

from .test_config import TestEnvironment, TestFileGenerator, TestAssertions, TEST_CONFIG

__version__ = '1.0.0'
__author__ = 'File Transfer System'

__all__ = [
    'TestEnvironment',
    'TestFileGenerator', 
    'TestAssertions',
    'TEST_CONFIG'
]