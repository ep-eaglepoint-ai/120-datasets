#!/usr/bin/env python3
"""
Test Configuration and Utilities
Common configuration and helper functions for all tests.
"""

import os
import tempfile
import shutil
import threading
import time
from pathlib import Path


class TestEnvironment:
    """Manages test environment setup and cleanup"""
    
    def __init__(self, prefix='file_transfer_test_'):
        self.test_dir = None
        self.server_files_dir = None
        self.client_downloads_dir = None
        self.logs_dir = None
        self.prefix = prefix
        self.server = None
        self.server_thread = None
        self.test_port = None
    
    def setup(self, port=19999):
        """Set up test environment"""
        self.test_dir = tempfile.mkdtemp(prefix=self.prefix)
        self.server_files_dir = os.path.join(self.test_dir, 'server_files')
        self.client_downloads_dir = os.path.join(self.test_dir, 'client_downloads')
        self.logs_dir = os.path.join(self.test_dir, 'logs')
        self.test_port = port
        
        # Create directories
        os.makedirs(self.server_files_dir, exist_ok=True)
        os.makedirs(self.client_downloads_dir, exist_ok=True)
        os.makedirs(self.logs_dir, exist_ok=True)
        
        return self
    
    def cleanup(self):
        """Clean up test environment"""
        if self.server:
            try:
                from server import shutdown_flag
                shutdown_flag.set()
                if self.server_thread:
                    self.server_thread.join(timeout=5)
            except:
                pass
        
        if self.test_dir and os.path.exists(self.test_dir):
            try:
                shutil.rmtree(self.test_dir)
            except Exception as e:
                print(f"Warning: Could not clean up test directory: {e}")
    
    def create_test_file(self, filename, content=None, size_bytes=None):
        """Create a test file with specified content or size"""
        filepath = os.path.join(self.server_files_dir, filename)
        
        if content is not None:
            # Create file with specific content
            if isinstance(content, str):
                with open(filepath, 'w') as f:
                    f.write(content)
            else:
                with open(filepath, 'wb') as f:
                    f.write(content)
        elif size_bytes is not None:
            # Create file with specific size (random data)
            with open(filepath, 'wb') as f:
                f.write(os.urandom(size_bytes))
        else:
            # Create default test file
            with open(filepath, 'w') as f:
                f.write(f"Test file: {filename}\nCreated for testing purposes.\n")
        
        return filepath
    
    def start_server(self, implementation='after'):
        """Start test server"""
        import sys
        import importlib
        
        # Clear any cached modules
        modules_to_clear = ['server', 'client']
        for module_name in modules_to_clear:
            if module_name in sys.modules:
                del sys.modules[module_name]
        
        impl_path = os.path.join(os.path.dirname(__file__), '..', f'repository_{implementation}')
        # Remove any existing paths to avoid conflicts
        paths_to_remove = [p for p in sys.path if 'repository_' in p]
        for path in paths_to_remove:
            sys.path.remove(path)
        
        sys.path.insert(0, impl_path)
        
        if implementation == 'after':
            import server
            from server import FileTransferServer, shutdown_flag
            
            # Monkey patch directories
            original_server_files_dir = server.SERVER_FILES_DIR
            original_log_dir = server.LOG_DIR
            
            server.SERVER_FILES_DIR = self.server_files_dir
            server.LOG_DIR = self.logs_dir
            
            self.server = FileTransferServer(host='127.0.0.1', port=self.test_port)
            self.server_thread = threading.Thread(target=self.server.start, daemon=True)
            self.server_thread.start()
            
            # Wait for server to start
            time.sleep(1)
            
            # Don't restore original values - server needs to keep using test directories
            # Original values will be restored in cleanup()
        else:
            # Basic implementation (before)
            import server
            
            # Change to server files directory for basic server
            original_cwd = os.getcwd()
            os.chdir(self.server_files_dir)
            
            def run_basic_server():
                try:
                    import socket
                    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                    server_socket.bind(('127.0.0.1', self.test_port))
                    server_socket.listen(1)
                    
                    print(f"Basic server listening on port {self.test_port}")
                    
                    while True:
                        try:
                            client_socket, client_addr = server_socket.accept()
                            print(f"Connection from {client_addr}")
                            server.handle_client(client_socket, client_addr)
                        except Exception as e:
                            print(f"Error handling client: {e}")
                            break
                            
                except Exception as e:
                    print(f"Server error: {e}")
                finally:
                    os.chdir(original_cwd)
            
            self.server_thread = threading.Thread(target=run_basic_server, daemon=True)
            self.server_thread.start()
            time.sleep(2)  # Give basic server more time to start
        
        return self.server
    
    def get_client(self, implementation='after'):
        """Get configured test client"""
        import sys
        import importlib
        
        # Clear any cached modules
        modules_to_clear = ['client']
        for module_name in modules_to_clear:
            if module_name in sys.modules:
                del sys.modules[module_name]
        
        impl_path = os.path.join(os.path.dirname(__file__), '..', f'repository_{implementation}')
        # Remove any existing paths to avoid conflicts
        paths_to_remove = [p for p in sys.path if 'repository_' in p]
        for path in paths_to_remove:
            sys.path.remove(path)
        
        sys.path.insert(0, impl_path)
        
        if implementation == 'after':
            import client
            from client import FileTransferClient
            
            # Monkey patch directories
            original_download_dir = client.CLIENT_DOWNLOAD_DIR
            original_log_dir = client.LOG_DIR
            
            client.CLIENT_DOWNLOAD_DIR = self.client_downloads_dir
            client.LOG_DIR = self.logs_dir
            
            test_client = FileTransferClient(host='127.0.0.1', port=self.test_port)
            
            # Store original values for restoration
            test_client._original_download_dir = original_download_dir
            test_client._original_log_dir = original_log_dir
            
            return test_client
        else:
            # Basic implementation (before)
            import client
            from client import download_file
            
            class BasicClientWrapper:
                def __init__(self, host, port, download_dir):
                    self.host = host
                    self.port = port
                    self.download_dir = download_dir
                
                def download(self, filename):
                    try:
                        # Change to download directory
                        original_cwd = os.getcwd()
                        os.chdir(self.download_dir)
                        
                        # Use basic download function
                        result = download_file(self.host, self.port, filename)
                        
                        # Move downloaded file to proper location
                        downloaded_file = f"downloaded_{filename}"
                        if os.path.exists(downloaded_file):
                            final_path = os.path.join(self.download_dir, filename)
                            if os.path.exists(final_path):
                                os.remove(final_path)
                            os.rename(downloaded_file, final_path)
                        
                        os.chdir(original_cwd)
                        return result
                    except Exception as e:
                        print(f"Download error: {e}")
                        try:
                            os.chdir(original_cwd)
                        except:
                            pass
                        return False
            
            return BasicClientWrapper('127.0.0.1', self.test_port, self.client_downloads_dir)
    
    def restore_client_dirs(self, client):
        """Restore original client directories"""
        import client as client_module
        
        if hasattr(client, '_original_download_dir'):
            client_module.CLIENT_DOWNLOAD_DIR = client._original_download_dir
        if hasattr(client, '_original_log_dir'):
            client_module.LOG_DIR = client._original_log_dir


class TestFileGenerator:
    """Utility class for generating test files"""
    
    @staticmethod
    def create_text_file(filepath, lines=10, line_content="Test line"):
        """Create a text file with specified number of lines"""
        with open(filepath, 'w') as f:
            for i in range(lines):
                f.write(f"{line_content} {i}\n")
    
    @staticmethod
    def create_binary_file(filepath, size_bytes):
        """Create a binary file with random data"""
        with open(filepath, 'wb') as f:
            # Write in chunks to avoid memory issues with large files
            chunk_size = 8192
            remaining = size_bytes
            
            while remaining > 0:
                chunk_size_to_write = min(chunk_size, remaining)
                f.write(os.urandom(chunk_size_to_write))
                remaining -= chunk_size_to_write
    
    @staticmethod
    def create_json_file(filepath, data=None):
        """Create a JSON file with test data"""
        import json
        
        if data is None:
            data = {
                "test": True,
                "message": "This is a test JSON file",
                "numbers": [1, 2, 3, 4, 5],
                "nested": {
                    "key": "value",
                    "array": ["a", "b", "c"]
                }
            }
        
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
    
    @staticmethod
    def create_empty_file(filepath):
        """Create an empty file"""
        Path(filepath).touch()


class TestAssertions:
    """Custom assertion helpers for file transfer tests"""
    
    @staticmethod
    def assert_file_exists(filepath, message=None):
        """Assert that a file exists"""
        if not os.path.exists(filepath):
            raise AssertionError(message or f"File does not exist: {filepath}")
    
    @staticmethod
    def assert_file_size(filepath, expected_size, message=None):
        """Assert that a file has the expected size"""
        if not os.path.exists(filepath):
            raise AssertionError(f"File does not exist: {filepath}")
        
        actual_size = os.path.getsize(filepath)
        if actual_size != expected_size:
            raise AssertionError(
                message or f"File size mismatch: expected {expected_size}, got {actual_size}"
            )
    
    @staticmethod
    def assert_file_checksum(filepath, expected_checksum, message=None):
        """Assert that a file has the expected MD5 checksum"""
        import hashlib
        
        if not os.path.exists(filepath):
            raise AssertionError(f"File does not exist: {filepath}")
        
        md5_hash = hashlib.md5()
        with open(filepath, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                md5_hash.update(chunk)
        
        actual_checksum = md5_hash.hexdigest()
        if actual_checksum != expected_checksum:
            raise AssertionError(
                message or f"Checksum mismatch: expected {expected_checksum}, got {actual_checksum}"
            )
    
    @staticmethod
    def assert_files_identical(filepath1, filepath2, message=None):
        """Assert that two files are identical"""
        import hashlib
        
        if not os.path.exists(filepath1):
            raise AssertionError(f"First file does not exist: {filepath1}")
        if not os.path.exists(filepath2):
            raise AssertionError(f"Second file does not exist: {filepath2}")
        
        # Compare sizes first (faster)
        size1 = os.path.getsize(filepath1)
        size2 = os.path.getsize(filepath2)
        
        if size1 != size2:
            raise AssertionError(
                message or f"File sizes differ: {filepath1} ({size1}) vs {filepath2} ({size2})"
            )
        
        # Compare checksums
        def get_checksum(filepath):
            md5_hash = hashlib.md5()
            with open(filepath, 'rb') as f:
                for chunk in iter(lambda: f.read(4096), b''):
                    md5_hash.update(chunk)
            return md5_hash.hexdigest()
        
        checksum1 = get_checksum(filepath1)
        checksum2 = get_checksum(filepath2)
        
        if checksum1 != checksum2:
            raise AssertionError(
                message or f"File checksums differ: {filepath1} ({checksum1}) vs {filepath2} ({checksum2})"
            )


# Test configuration constants
TEST_CONFIG = {
    'DEFAULT_TEST_PORT': 19999,
    'PERFORMANCE_TEST_PORT': 19998,
    'ERROR_TEST_PORT': 19997,
    'TIMEOUT_SECONDS': 30,
    'LARGE_FILE_SIZE': 10 * 1024 * 1024,  # 10MB
    'MEDIUM_FILE_SIZE': 1024 * 1024,      # 1MB
    'SMALL_FILE_SIZE': 1024,              # 1KB
}


# Export commonly used items
__all__ = [
    'TestEnvironment',
    'TestFileGenerator', 
    'TestAssertions',
    'TEST_CONFIG'
]