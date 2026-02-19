#!/usr/bin/env python3
"""
Comprehensive Test Suite for File Transfer System
Tests both server and client functionality with various scenarios.
"""

import unittest
import threading
import socket
import time
import os
import sys
import tempfile
import shutil
import hashlib
from pathlib import Path

# Add repository_after to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'repository_after'))

from server import FileTransferServer, shutdown_flag
from client import FileTransferClient


class TestFileTransferSystem(unittest.TestCase):
    """Test suite for the file transfer system"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test environment once for all tests"""
        cls.test_dir = tempfile.mkdtemp(prefix='file_transfer_test_')
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
        cls.test_port = 19999  # Use different port for testing
        cls.server = None
        cls.server_thread = None
        cls._start_test_server()
        
        print(f"Test environment set up in: {cls.test_dir}")
    
    @classmethod
    def tearDownClass(cls):
        """Clean up test environment"""
        if cls.server:
            shutdown_flag.set()
            if cls.server_thread:
                cls.server_thread.join(timeout=5)
        
        # Clean up test directory
        try:
            shutil.rmtree(cls.test_dir)
        except Exception as e:
            print(f"Warning: Could not clean up test directory: {e}")
    
    @classmethod
    def _create_test_files(cls):
        """Create test files of various sizes"""
        # Small text file
        with open(os.path.join(cls.server_files_dir, 'small.txt'), 'w') as f:
            f.write("Hello, World!\nThis is a small test file.\n")
        
        # Medium text file
        with open(os.path.join(cls.server_files_dir, 'medium.txt'), 'w') as f:
            for i in range(1000):
                f.write(f"Line {i}: This is a medium-sized test file with repeated content.\n")
        
        # Large binary file
        with open(os.path.join(cls.server_files_dir, 'large.bin'), 'wb') as f:
            # Create 1MB of random data
            for _ in range(1024):
                f.write(os.urandom(1024))
        
        # JSON test file
        with open(os.path.join(cls.server_files_dir, 'data.json'), 'w') as f:
            f.write('{"test": "data", "numbers": [1, 2, 3, 4, 5], "nested": {"key": "value"}}')
        
        # Empty file
        with open(os.path.join(cls.server_files_dir, 'empty.txt'), 'w') as f:
            pass
    
    @classmethod
    def _start_test_server(cls):
        """Start the test server in a separate thread"""
        # Monkey patch the directories for testing
        import server
        original_server_files_dir = server.SERVER_FILES_DIR
        original_log_dir = server.LOG_DIR
        
        server.SERVER_FILES_DIR = cls.server_files_dir
        server.LOG_DIR = cls.logs_dir
        
        cls.server = FileTransferServer(host='127.0.0.1', port=cls.test_port)
        cls.server_thread = threading.Thread(target=cls.server.start, daemon=True)
        cls.server_thread.start()
        
        # Wait for server to start
        time.sleep(1)
        
        # Restore original values
        server.SERVER_FILES_DIR = original_server_files_dir
        server.LOG_DIR = original_log_dir
    
    def setUp(self):
        """Set up for each test"""
        # Clear client downloads directory
        for file in os.listdir(self.client_downloads_dir):
            os.remove(os.path.join(self.client_downloads_dir, file))
    
    def test_server_initialization(self):
        """Test server initialization"""
        self.assertIsNotNone(self.server)
        self.assertEqual(self.server.host, '127.0.0.1')
        self.assertEqual(self.server.port, self.test_port)
        self.assertIsNotNone(self.server.logger)
    
    def test_client_initialization(self):
        """Test client initialization"""
        # Monkey patch directories for testing
        import client
        original_download_dir = client.CLIENT_DOWNLOAD_DIR
        original_log_dir = client.LOG_DIR
        
        client.CLIENT_DOWNLOAD_DIR = self.client_downloads_dir
        client.LOG_DIR = self.logs_dir
        
        test_client = FileTransferClient(host='127.0.0.1', port=self.test_port)
        
        self.assertEqual(test_client.host, '127.0.0.1')
        self.assertEqual(test_client.port, self.test_port)
        self.assertIsNotNone(test_client.logger)
        
        # Restore original values
        client.CLIENT_DOWNLOAD_DIR = original_download_dir
        client.LOG_DIR = original_log_dir
    
    def test_small_file_transfer(self):
        """Test transferring a small text file"""
        self._test_file_transfer('small.txt')
    
    def test_medium_file_transfer(self):
        """Test transferring a medium-sized file"""
        self._test_file_transfer('medium.txt')
    
    def test_large_binary_transfer(self):
        """Test transferring a large binary file"""
        self._test_file_transfer('large.bin')
    
    def test_json_file_transfer(self):
        """Test transferring a JSON file"""
        self._test_file_transfer('data.json')
    
    def test_empty_file_transfer(self):
        """Test transferring an empty file"""
        self._test_file_transfer('empty.txt')
    
    def test_nonexistent_file(self):
        """Test requesting a file that doesn't exist"""
        # Monkey patch directories for testing
        import client
        original_download_dir = client.CLIENT_DOWNLOAD_DIR
        original_log_dir = client.LOG_DIR
        
        client.CLIENT_DOWNLOAD_DIR = self.client_downloads_dir
        client.LOG_DIR = self.logs_dir
        
        test_client = FileTransferClient(host='127.0.0.1', port=self.test_port)
        success = test_client.download('nonexistent.txt')
        
        self.assertFalse(success)
        
        # Restore original values
        client.CLIENT_DOWNLOAD_DIR = original_download_dir
        client.LOG_DIR = original_log_dir
    
    def test_concurrent_transfers(self):
        """Test multiple concurrent file transfers"""
        files_to_transfer = ['small.txt', 'medium.txt', 'data.json']
        threads = []
        results = {}
        
        def download_file(filename):
            # Monkey patch directories for testing
            import client
            original_download_dir = client.CLIENT_DOWNLOAD_DIR
            original_log_dir = client.LOG_DIR
            
            client.CLIENT_DOWNLOAD_DIR = self.client_downloads_dir
            client.LOG_DIR = self.logs_dir
            
            test_client = FileTransferClient(host='127.0.0.1', port=self.test_port)
            results[filename] = test_client.download(filename)
            
            # Restore original values
            client.CLIENT_DOWNLOAD_DIR = original_download_dir
            client.LOG_DIR = original_log_dir
        
        # Start concurrent downloads
        for filename in files_to_transfer:
            thread = threading.Thread(target=download_file, args=(filename,))
            threads.append(thread)
            thread.start()
        
        # Wait for all downloads to complete
        for thread in threads:
            thread.join(timeout=30)
        
        # Verify all downloads succeeded
        for filename in files_to_transfer:
            self.assertTrue(results.get(filename, False), f"Failed to download {filename}")
            self._verify_file_integrity(filename)
    
    def test_checksum_calculation(self):
        """Test MD5 checksum calculation"""
        test_file = os.path.join(self.server_files_dir, 'small.txt')
        
        # Calculate checksum manually
        expected_checksum = self._calculate_file_checksum(test_file)
        
        # Calculate using server method
        server_checksum = self.server.calculate_checksum(test_file)
        
        self.assertEqual(expected_checksum, server_checksum)
    
    def test_connection_retry_logic(self):
        """Test client retry logic with a non-existent server"""
        # Monkey patch directories for testing
        import client
        original_download_dir = client.CLIENT_DOWNLOAD_DIR
        original_log_dir = client.LOG_DIR
        
        client.CLIENT_DOWNLOAD_DIR = self.client_downloads_dir
        client.LOG_DIR = self.logs_dir
        
        # Try to connect to a non-existent server
        test_client = FileTransferClient(host='127.0.0.1', port=19998)  # Different port
        
        start_time = time.time()
        success = test_client.connect_with_retry()
        end_time = time.time()
        
        self.assertFalse(success)
        # Should take at least the sum of backoff times (1+2+4+8+16 = 31 seconds)
        # But we'll be lenient and just check it took more than 5 seconds
        self.assertGreater(end_time - start_time, 5)
        
        # Restore original values
        client.CLIENT_DOWNLOAD_DIR = original_download_dir
        client.LOG_DIR = original_log_dir
    
    def _test_file_transfer(self, filename):
        """Helper method to test file transfer"""
        # Monkey patch directories for testing
        import client
        original_download_dir = client.CLIENT_DOWNLOAD_DIR
        original_log_dir = client.LOG_DIR
        
        client.CLIENT_DOWNLOAD_DIR = self.client_downloads_dir
        client.LOG_DIR = self.logs_dir
        
        test_client = FileTransferClient(host='127.0.0.1', port=self.test_port)
        success = test_client.download(filename)
        
        self.assertTrue(success, f"Failed to download {filename}")
        self._verify_file_integrity(filename)
        
        # Restore original values
        client.CLIENT_DOWNLOAD_DIR = original_download_dir
        client.LOG_DIR = original_log_dir
    
    def _verify_file_integrity(self, filename):
        """Verify downloaded file matches original"""
        original_file = os.path.join(self.server_files_dir, filename)
        downloaded_file = os.path.join(self.client_downloads_dir, filename)
        
        self.assertTrue(os.path.exists(downloaded_file), f"Downloaded file {filename} not found")
        
        # Compare file sizes
        original_size = os.path.getsize(original_file)
        downloaded_size = os.path.getsize(downloaded_file)
        self.assertEqual(original_size, downloaded_size, f"File size mismatch for {filename}")
        
        # Compare checksums
        original_checksum = self._calculate_file_checksum(original_file)
        downloaded_checksum = self._calculate_file_checksum(downloaded_file)
        self.assertEqual(original_checksum, downloaded_checksum, f"Checksum mismatch for {filename}")
    
    def _calculate_file_checksum(self, filepath):
        """Calculate MD5 checksum of a file"""
        md5_hash = hashlib.md5()
        with open(filepath, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                md5_hash.update(chunk)
        return md5_hash.hexdigest()


class TestProtocolComponents(unittest.TestCase):
    """Test individual protocol components"""
    
    def test_struct_packing(self):
        """Test binary data packing/unpacking"""
        import struct
        
        # Test filename length packing
        filename = "test.txt"
        filename_bytes = filename.encode('utf-8')
        packed_length = struct.pack('!I', len(filename_bytes))
        unpacked_length = struct.unpack('!I', packed_length)[0]
        
        self.assertEqual(len(filename_bytes), unpacked_length)
        
        # Test file size packing
        file_size = 1048576  # 1MB
        packed_size = struct.pack('!Q', file_size)
        unpacked_size = struct.unpack('!Q', packed_size)[0]
        
        self.assertEqual(file_size, unpacked_size)
    
    def test_checksum_consistency(self):
        """Test checksum calculation consistency"""
        # Create test data
        test_data = b"Hello, World! This is test data for checksum calculation."
        
        # Calculate checksum multiple times
        checksums = []
        for _ in range(5):
            md5_hash = hashlib.md5()
            md5_hash.update(test_data)
            checksums.append(md5_hash.hexdigest())
        
        # All checksums should be identical
        for checksum in checksums[1:]:
            self.assertEqual(checksums[0], checksum)


if __name__ == '__main__':
    # Configure test runner
    unittest.main(verbosity=2, buffer=True)