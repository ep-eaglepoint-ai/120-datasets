#!/usr/bin/env python3
"""
Performance Tests for File Transfer System
Tests transfer speeds, concurrent connections, and resource usage.
"""

import unittest
import threading
import time
import os
import sys
import tempfile
import shutil
import statistics
from pathlib import Path

# Add repository_after to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'repository_after'))

from server import FileTransferServer, shutdown_flag
from client import FileTransferClient


class TestPerformance(unittest.TestCase):
    """Performance test suite"""
    
    @classmethod
    def setUpClass(cls):
        """Set up performance test environment"""
        cls.test_dir = tempfile.mkdtemp(prefix='perf_test_')
        cls.server_files_dir = os.path.join(cls.test_dir, 'server_files')
        cls.client_downloads_dir = os.path.join(cls.test_dir, 'client_downloads')
        cls.logs_dir = os.path.join(cls.test_dir, 'logs')
        
        # Create directories
        os.makedirs(cls.server_files_dir, exist_ok=True)
        os.makedirs(cls.client_downloads_dir, exist_ok=True)
        os.makedirs(cls.logs_dir, exist_ok=True)
        
        # Create performance test files
        cls._create_performance_test_files()
        
        # Start test server
        cls.test_port = 19998
        cls.server = None
        cls.server_thread = None
        cls._start_test_server()
        
        print(f"Performance test environment set up in: {cls.test_dir}")
    
    @classmethod
    def tearDownClass(cls):
        """Clean up performance test environment"""
        if cls.server:
            shutdown_flag.set()
            if cls.server_thread:
                cls.server_thread.join(timeout=5)
        
        try:
            shutil.rmtree(cls.test_dir)
        except Exception as e:
            print(f"Warning: Could not clean up test directory: {e}")
    
    @classmethod
    def _create_performance_test_files(cls):
        """Create files for performance testing"""
        # 1MB file
        with open(os.path.join(cls.server_files_dir, '1mb.bin'), 'wb') as f:
            f.write(os.urandom(1024 * 1024))
        
        # 5MB file
        with open(os.path.join(cls.server_files_dir, '5mb.bin'), 'wb') as f:
            f.write(os.urandom(5 * 1024 * 1024))
        
        # 10MB file
        with open(os.path.join(cls.server_files_dir, '10mb.bin'), 'wb') as f:
            f.write(os.urandom(10 * 1024 * 1024))
        
        # Small files for concurrent testing
        for i in range(20):
            with open(os.path.join(cls.server_files_dir, f'small_{i}.txt'), 'w') as f:
                f.write(f"Small test file {i}\n" * 100)
    
    @classmethod
    def _start_test_server(cls):
        """Start the performance test server"""
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
        """Set up for each performance test"""
        # Clear client downloads directory
        for file in os.listdir(self.client_downloads_dir):
            os.remove(os.path.join(self.client_downloads_dir, file))
    
    def test_transfer_speed_1mb(self):
        """Test transfer speed for 1MB file"""
        transfer_time = self._measure_transfer_time('1mb.bin')
        file_size_mb = 1
        speed_mbps = file_size_mb / transfer_time
        
        print(f"1MB transfer time: {transfer_time:.2f}s, Speed: {speed_mbps:.2f} MB/s")
        
        # Should complete within reasonable time (adjust based on system)
        self.assertLess(transfer_time, 10, "1MB transfer took too long")
        self.assertGreater(speed_mbps, 0.1, "Transfer speed too slow")
    
    def test_transfer_speed_5mb(self):
        """Test transfer speed for 5MB file"""
        transfer_time = self._measure_transfer_time('5mb.bin')
        file_size_mb = 5
        speed_mbps = file_size_mb / transfer_time
        
        print(f"5MB transfer time: {transfer_time:.2f}s, Speed: {speed_mbps:.2f} MB/s")
        
        self.assertLess(transfer_time, 30, "5MB transfer took too long")
        self.assertGreater(speed_mbps, 0.1, "Transfer speed too slow")
    
    def test_transfer_speed_10mb(self):
        """Test transfer speed for 10MB file"""
        transfer_time = self._measure_transfer_time('10mb.bin')
        file_size_mb = 10
        speed_mbps = file_size_mb / transfer_time
        
        print(f"10MB transfer time: {transfer_time:.2f}s, Speed: {speed_mbps:.2f} MB/s")
        
        self.assertLess(transfer_time, 60, "10MB transfer took too long")
        self.assertGreater(speed_mbps, 0.1, "Transfer speed too slow")
    
    def test_concurrent_connections(self):
        """Test multiple concurrent connections"""
        num_clients = 10
        files_to_transfer = [f'small_{i}.txt' for i in range(num_clients)]
        
        start_time = time.time()
        threads = []
        results = {}
        
        def download_file(filename):
            import client
            original_download_dir = client.CLIENT_DOWNLOAD_DIR
            original_log_dir = client.LOG_DIR
            
            client.CLIENT_DOWNLOAD_DIR = self.client_downloads_dir
            client.LOG_DIR = self.logs_dir
            
            test_client = FileTransferClient(host='127.0.0.1', port=self.test_port)
            results[filename] = test_client.download(filename)
            
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
        
        end_time = time.time()
        total_time = end_time - start_time
        
        print(f"Concurrent downloads ({num_clients} clients): {total_time:.2f}s")
        
        # Verify all downloads succeeded
        successful_downloads = sum(1 for success in results.values() if success)
        self.assertEqual(successful_downloads, num_clients, 
                        f"Only {successful_downloads}/{num_clients} downloads succeeded")
        
        # Should complete within reasonable time
        self.assertLess(total_time, 30, "Concurrent downloads took too long")
    
    def test_repeated_transfers(self):
        """Test consistency across multiple transfers"""
        filename = '1mb.bin'
        num_transfers = 5
        transfer_times = []
        
        for i in range(num_transfers):
            # Clear previous download
            downloaded_file = os.path.join(self.client_downloads_dir, filename)
            if os.path.exists(downloaded_file):
                os.remove(downloaded_file)
            
            transfer_time = self._measure_transfer_time(filename)
            transfer_times.append(transfer_time)
            print(f"Transfer {i+1}: {transfer_time:.2f}s")
        
        # Calculate statistics
        avg_time = statistics.mean(transfer_times)
        std_dev = statistics.stdev(transfer_times) if len(transfer_times) > 1 else 0
        
        print(f"Average transfer time: {avg_time:.2f}s ± {std_dev:.2f}s")
        
        # Check consistency (standard deviation should be reasonable)
        self.assertLess(std_dev, avg_time * 0.5, "Transfer times too inconsistent")
    
    def test_memory_usage_large_file(self):
        """Test memory usage doesn't grow excessively with large files"""
        import psutil
        import gc
        
        # Get initial memory usage
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Transfer large file
        self._measure_transfer_time('10mb.bin')
        
        # Force garbage collection
        gc.collect()
        
        # Get final memory usage
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        print(f"Memory usage: {initial_memory:.1f}MB → {final_memory:.1f}MB (+{memory_increase:.1f}MB)")
        
        # Memory increase should be reasonable (less than file size)
        self.assertLess(memory_increase, 50, "Memory usage increased too much")
    
    def _measure_transfer_time(self, filename):
        """Measure time to transfer a file"""
        import client
        original_download_dir = client.CLIENT_DOWNLOAD_DIR
        original_log_dir = client.LOG_DIR
        
        client.CLIENT_DOWNLOAD_DIR = self.client_downloads_dir
        client.LOG_DIR = self.logs_dir
        
        test_client = FileTransferClient(host='127.0.0.1', port=self.test_port)
        
        start_time = time.time()
        success = test_client.download(filename)
        end_time = time.time()
        
        self.assertTrue(success, f"Failed to download {filename}")
        
        client.CLIENT_DOWNLOAD_DIR = original_download_dir
        client.LOG_DIR = original_log_dir
        
        return end_time - start_time


if __name__ == '__main__':
    unittest.main(verbosity=2, buffer=True)