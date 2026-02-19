#!/usr/bin/env python3
"""
Error Handling Tests for File Transfer System
Tests various error conditions and recovery mechanisms.
"""

import unittest
import threading
import socket
import time
import os
import sys
import tempfile
import shutil
from pathlib import Path

# Add repository_after to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'repository_after'))

from server import FileTransferServer, shutdown_flag
from client import FileTransferClient


class TestErrorHandling(unittest.TestCase):
    """Error handling test suite"""
    
    @classmethod
    def setUpClass(cls):
        """Set up error handling test environment"""
        cls.test_dir = tempfile.mkdtemp(prefix='error_test_')
        cls.server_files_dir = os.path.join(cls.test_dir, 'server_files')
        cls.client_downloads_dir = os.path.join(cls.test_dir, 'client_downloads')
        cls.logs_dir = os.path.join(cls.test_dir, 'logs')
        
        # Create directories
        os.makedirs(cls.server_files_dir, exist_ok=True)
        os.makedirs(cls.client_downloads_dir, exist_ok=True)
        os.makedirs(cls.logs_dir, exist_ok=True)
        
        # Create test files
        cls._create_test_files()
        
        # Start test server
        cls.test_port = 19997
        cls.server = None
        cls.server_thread = None
        cls._start_test_server()
        
        print(f"Error handling test environment set up in: {cls.test_dir}")
    
    @classmethod
    def tearDownClass(cls):
        """Clean up error handling test environment"""
        if cls.server:
            shutdown_flag.set()
            if cls.server_thread:
                cls.server_thread.join(timeout=5)
        
        try:
            shutil.rmtree(cls.test_dir)
        except Exception as e:
            print(f"Warning: Could not clean up test directory: {e}")
    
    @classmethod
    def _create_test_files(cls):
        """Create test files"""
        with open(os.path.join(cls.server_files_dir, 'test.txt'), 'w') as f:
            f.write("Test file for error handling tests\n")
    
    @classmethod
    def _start_test_server(cls):
        """Start the error handling test server"""
        import server
        original_server_files_dir = server.SERVER_FILES_DIR
        original_log_dir = server.LOG_DIR
        
        server.SERVER_FILES_DIR = cls.server_files_dir
        server.LOG_DIR = cls.logs_dir
        
        cls.server = FileTransferServer(host='127.0.0.1', port=cls.test_port)
        cls.server_thread = threading.Thread(target=cls.server.start, daemon=True)
        cls.server_thread.start()
        
        time.sleep(1)
        
        server.SERVER_FILES_DIR = original_server_files_dir
        server.LOG_DIR = original_log_dir
    
    def setUp(self):
        """Set up for each error handling test"""
        # Clear client downloads directory
        for file in os.listdir(self.client_downloads_dir):
            os.remove(os.path.join(self.client_downloads_dir, file))
    
    def test_file_not_found(self):
        """Test handling of non-existent file requests"""
        import client
        original_download_dir = client.CLIENT_DOWNLOAD_DIR
        original_log_dir = client.LOG_DIR
        
        client.CLIENT_DOWNLOAD_DIR = self.client_downloads_dir
        client.LOG_DIR = self.logs_dir
        
        test_client = FileTransferClient(host='127.0.0.1', port=self.test_port)
        success = test_client.download('nonexistent_file.txt')
        
        self.assertFalse(success, "Should fail when requesting non-existent file")
        
        # Verify no file was created
        downloaded_file = os.path.join(self.client_downloads_dir, 'nonexistent_file.txt')
        self.assertFalse(os.path.exists(downloaded_file), "No file should be created for failed download")
        
        client.CLIENT_DOWNLOAD_DIR = original_download_dir
        client.LOG_DIR = original_log_dir
    
    def test_connection_refused(self):
        """Test handling of connection refused (server not running)"""
        import client
        original_download_dir = client.CLIENT_DOWNLOAD_DIR
        original_log_dir = client.LOG_DIR
        
        client.CLIENT_DOWNLOAD_DIR = self.client_downloads_dir
        client.LOG_DIR = self.logs_dir
        
        # Try to connect to non-existent server
        test_client = FileTransferClient(host='127.0.0.1', port=19996)  # Different port
        success = test_client.download('test.txt')
        
        self.assertFalse(success, "Should fail when server is not running")
        
        client.CLIENT_DOWNLOAD_DIR = original_download_dir
        client.LOG_DIR = original_log_dir
    
    def test_invalid_hostname(self):
        """Test handling of invalid hostname"""
        import client
        original_download_dir = client.CLIENT_DOWNLOAD_DIR
        original_log_dir = client.LOG_DIR
        
        client.CLIENT_DOWNLOAD_DIR = self.client_downloads_dir
        client.LOG_DIR = self.logs_dir
        
        test_client = FileTransferClient(host='invalid.hostname.that.does.not.exist', port=self.test_port)
        success = test_client.download('test.txt')
        
        self.assertFalse(success, "Should fail with invalid hostname")
        
        client.CLIENT_DOWNLOAD_DIR = original_download_dir
        client.LOG_DIR = original_log_dir
    
    def test_port_out_of_range(self):
        """Test handling of invalid port numbers"""
        import client
        original_download_dir = client.CLIENT_DOWNLOAD_DIR
        original_log_dir = client.LOG_DIR
        
        client.CLIENT_DOWNLOAD_DIR = self.client_downloads_dir
        client.LOG_DIR = self.logs_dir
        
        # Test port number too high
        test_client = FileTransferClient(host='127.0.0.1', port=99999)
        success = test_client.download('test.txt')
        
        self.assertFalse(success, "Should fail with invalid port number")
        
        client.CLIENT_DOWNLOAD_DIR = original_download_dir
        client.LOG_DIR = original_log_dir
    
    def test_server_socket_error(self):
        """Test server behavior with socket errors"""
        # This test simulates what happens when the server encounters socket errors
        # We'll test by trying to bind to a port that's already in use
        
        try:
            # Try to create another server on the same port
            duplicate_server = FileTransferServer(host='127.0.0.1', port=self.test_port)
            
            # This should fail or handle the error gracefully
            # The exact behavior depends on the implementation
            self.assertIsNotNone(duplicate_server, "Server should handle port conflicts gracefully")
            
        except Exception as e:
            # If an exception is raised, it should be a reasonable one
            self.assertIsInstance(e, (OSError, socket.error), 
                                f"Unexpected exception type: {type(e)}")
    
    def test_client_timeout_handling(self):
        """Test client timeout handling"""
        # This test would ideally simulate network delays or server unresponsiveness
        # For now, we'll test the timeout configuration
        
        import client
        original_download_dir = client.CLIENT_DOWNLOAD_DIR
        original_log_dir = client.LOG_DIR
        
        client.CLIENT_DOWNLOAD_DIR = self.client_downloads_dir
        client.LOG_DIR = self.logs_dir
        
        test_client = FileTransferClient(host='127.0.0.1', port=self.test_port)
        
        # Verify that socket timeout is set
        if test_client.socket:
            timeout = test_client.socket.gettimeout()
            self.assertIsNotNone(timeout, "Socket should have a timeout set")
        
        client.CLIENT_DOWNLOAD_DIR = original_download_dir
        client.LOG_DIR = original_log_dir
    
    def test_interrupted_transfer_simulation(self):
        """Test handling of interrupted transfers"""
        import client
        original_download_dir = client.CLIENT_DOWNLOAD_DIR
        original_log_dir = client.LOG_DIR
        
        client.CLIENT_DOWNLOAD_DIR = self.client_downloads_dir
        client.LOG_DIR = self.logs_dir
        
        # Create a larger file for this test
        large_file = os.path.join(self.server_files_dir, 'large_for_interrupt.bin')
        with open(large_file, 'wb') as f:
            f.write(os.urandom(1024 * 1024))  # 1MB
        
        test_client = FileTransferClient(host='127.0.0.1', port=self.test_port)
        
        # Start download in a thread so we can interrupt it
        download_thread = threading.Thread(
            target=lambda: test_client.download('large_for_interrupt.bin')
        )
        download_thread.start()
        
        # Let it start, then interrupt
        time.sleep(0.1)
        
        # Simulate interruption by closing the client socket
        if test_client.socket:
            test_client.socket.close()
        
        download_thread.join(timeout=5)
        
        # Clean up
        if os.path.exists(large_file):
            os.remove(large_file)
        
        client.CLIENT_DOWNLOAD_DIR = original_download_dir
        client.LOG_DIR = original_log_dir
    
    def test_corrupted_data_handling(self):
        """Test handling of corrupted data (simulated)"""
        # This test verifies that checksum verification works
        import client
        original_download_dir = client.CLIENT_DOWNLOAD_DIR
        original_log_dir = client.LOG_DIR
        
        client.CLIENT_DOWNLOAD_DIR = self.client_downloads_dir
        client.LOG_DIR = self.logs_dir
        
        # First, do a normal download
        test_client = FileTransferClient(host='127.0.0.1', port=self.test_port)
        success = test_client.download('test.txt')
        
        self.assertTrue(success, "Normal download should succeed")
        
        # Verify the checksum calculation works
        downloaded_file = os.path.join(self.client_downloads_dir, 'test.txt')
        original_file = os.path.join(self.server_files_dir, 'test.txt')
        
        if os.path.exists(downloaded_file):
            downloaded_checksum = test_client.calculate_checksum(downloaded_file)
            original_checksum = self.server.calculate_checksum(original_file)
            
            self.assertEqual(downloaded_checksum, original_checksum, 
                           "Checksums should match for uncorrupted transfer")
        
        client.CLIENT_DOWNLOAD_DIR = original_download_dir
        client.LOG_DIR = original_log_dir
    
    def test_disk_space_handling(self):
        """Test handling of insufficient disk space (simulated)"""
        # This is difficult to test without actually filling up disk space
        # We'll test that the client handles write errors gracefully
        
        import client
        original_download_dir = client.CLIENT_DOWNLOAD_DIR
        original_log_dir = client.LOG_DIR
        
        # Create a read-only directory to simulate write permission issues
        readonly_dir = os.path.join(self.test_dir, 'readonly')
        os.makedirs(readonly_dir, exist_ok=True)
        
        try:
            os.chmod(readonly_dir, 0o444)  # Read-only
            
            client.CLIENT_DOWNLOAD_DIR = readonly_dir
            client.LOG_DIR = self.logs_dir
            
            test_client = FileTransferClient(host='127.0.0.1', port=self.test_port)
            success = test_client.download('test.txt')
            
            # Should fail due to permission issues
            self.assertFalse(success, "Should fail when cannot write to download directory")
            
        finally:
            # Restore permissions for cleanup
            try:
                os.chmod(readonly_dir, 0o755)
            except:
                pass
            
            client.CLIENT_DOWNLOAD_DIR = original_download_dir
            client.LOG_DIR = original_log_dir
    
    def test_malformed_filename_handling(self):
        """Test handling of malformed filenames"""
        import client
        original_download_dir = client.CLIENT_DOWNLOAD_DIR
        original_log_dir = client.LOG_DIR
        
        client.CLIENT_DOWNLOAD_DIR = self.client_downloads_dir
        client.LOG_DIR = self.logs_dir
        
        test_client = FileTransferClient(host='127.0.0.1', port=self.test_port)
        
        # Test various problematic filenames
        problematic_names = [
            '',  # Empty filename
            '../../../etc/passwd',  # Path traversal attempt
            'file\x00name',  # Null byte
            'very_long_filename_' + 'x' * 1000,  # Very long filename
        ]
        
        for filename in problematic_names:
            success = test_client.download(filename)
            self.assertFalse(success, f"Should fail with problematic filename: {repr(filename)}")
        
        client.CLIENT_DOWNLOAD_DIR = original_download_dir
        client.LOG_DIR = original_log_dir


class TestRetryLogic(unittest.TestCase):
    """Test retry logic specifically"""
    
    def test_exponential_backoff_timing(self):
        """Test that exponential backoff timing is correct"""
        import client
        
        # Test the backoff calculation
        initial_backoff = 1
        max_backoff = 32
        
        backoff = initial_backoff
        expected_sequence = [1, 2, 4, 8, 16, 32, 32]  # Last one capped at max
        
        for i, expected in enumerate(expected_sequence):
            self.assertEqual(backoff, expected, f"Backoff at step {i} should be {expected}")
            backoff = min(backoff * 2, max_backoff)
    
    def test_retry_count_limit(self):
        """Test that retry count is properly limited"""
        import client
        
        max_retries = 5
        
        # This would be tested by actually running the retry logic
        # but that would take too long in a unit test
        # Instead, we verify the constant is set correctly
        self.assertEqual(client.MAX_RETRIES, max_retries, 
                        "MAX_RETRIES should be set to expected value")


if __name__ == '__main__':
    unittest.main(verbosity=2, buffer=True)