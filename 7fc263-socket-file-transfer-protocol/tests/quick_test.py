#!/usr/bin/env python3
"""
Quick Test Runner for File Transfer System
Runs a subset of essential tests for quick validation.
"""

import unittest
import sys
import os
import time

# Add repository_after to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'repository_after'))
sys.path.insert(0, os.path.dirname(__file__))

from test_config import TestEnvironment, TestFileGenerator, TestAssertions


class QuickFunctionalityTest(unittest.TestCase):
    """Quick functionality test for basic validation"""
    
    @classmethod
    def setUpClass(cls):
        """Set up quick test environment"""
        cls.env = TestEnvironment().setup(port=19995)
        
        # Create basic test files
        cls.env.create_test_file('small.txt', content='Hello, World!\nThis is a test file.\n')
        cls.env.create_test_file('medium.bin', size_bytes=1024)  # 1KB
        
        # Start server
        cls.server = cls.env.start_server()
        
        print("Quick test environment ready")
    
    @classmethod
    def tearDownClass(cls):
        """Clean up quick test environment"""
        cls.env.cleanup()
    
    def test_basic_file_transfer(self):
        """Test basic file transfer functionality"""
        client = self.env.get_client()
        
        try:
            # Test small text file
            success = client.download('small.txt')
            self.assertTrue(success, "Should successfully download small text file")
            
            # Verify file exists and has correct content
            downloaded_file = os.path.join(self.env.client_downloads_dir, 'small.txt')
            TestAssertions.assert_file_exists(downloaded_file)
            
            # Verify content
            with open(downloaded_file, 'r') as f:
                content = f.read()
                self.assertIn('Hello, World!', content)
            
        finally:
            self.env.restore_client_dirs(client)
    
    def test_binary_file_transfer(self):
        """Test binary file transfer"""
        client = self.env.get_client()
        
        try:
            # Test binary file
            success = client.download('medium.bin')
            self.assertTrue(success, "Should successfully download binary file")
            
            # Verify file exists and has correct size
            downloaded_file = os.path.join(self.env.client_downloads_dir, 'medium.bin')
            TestAssertions.assert_file_exists(downloaded_file)
            TestAssertions.assert_file_size(downloaded_file, 1024)
            
        finally:
            self.env.restore_client_dirs(client)
    
    def test_nonexistent_file(self):
        """Test handling of non-existent file"""
        client = self.env.get_client()
        
        try:
            success = client.download('does_not_exist.txt')
            self.assertFalse(success, "Should fail when requesting non-existent file")
            
        finally:
            self.env.restore_client_dirs(client)
    
    def test_file_integrity(self):
        """Test file integrity verification"""
        client = self.env.get_client()
        
        try:
            success = client.download('small.txt')
            self.assertTrue(success, "Download should succeed")
            
            # Compare original and downloaded files
            original_file = os.path.join(self.env.server_files_dir, 'small.txt')
            downloaded_file = os.path.join(self.env.client_downloads_dir, 'small.txt')
            
            TestAssertions.assert_files_identical(original_file, downloaded_file)
            
        finally:
            self.env.restore_client_dirs(client)


def main():
    """Run quick tests"""
    print("File Transfer System - Quick Test Suite")
    print("=" * 50)
    print("Running essential tests for basic validation...")
    print()
    
    # Run the quick test suite
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(QuickFunctionalityTest)
    
    runner = unittest.TextTestRunner(verbosity=2, buffer=True)
    start_time = time.time()
    result = runner.run(suite)
    end_time = time.time()
    
    # Print summary
    print("\n" + "=" * 50)
    print("QUICK TEST SUMMARY")
    print("=" * 50)
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Duration: {end_time - start_time:.2f}s")
    
    if result.failures or result.errors:
        print("\n❌ SOME TESTS FAILED")
        print("Run the full test suite for detailed analysis:")
        print("  python tests/run_all_tests.py")
        return 1
    else:
        print("\n✅ ALL QUICK TESTS PASSED!")
        print("Basic functionality is working correctly.")
        print("\nFor comprehensive testing, run:")
        print("  python tests/run_all_tests.py")
        return 0


if __name__ == '__main__':
    sys.exit(main())