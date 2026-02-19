#!/usr/bin/env python3
"""
File Transfer Client
Connects to server with retry logic, displays progress bar, verifies file integrity.
"""

import socket
import sys
import signal
import logging
import hashlib
import struct
import time
import os
from pathlib import Path
from datetime import datetime

# Configuration
DEFAULT_HOST = 'localhost'
DEFAULT_PORT = 9999
BUFFER_SIZE = 4096
CLIENT_DOWNLOAD_DIR = "client_downloads"
LOG_DIR = "logs"

# Retry configuration
MAX_RETRIES = 5
INITIAL_BACKOFF = 1  # seconds
MAX_BACKOFF = 32  # seconds

# Global flag for graceful shutdown
shutdown_flag = False


class FileTransferClient:
    def __init__(self, host=DEFAULT_HOST, port=DEFAULT_PORT):
        self.host = host
        self.port = port
        self.socket = None
        
        # Setup logging
        self._setup_logging()
        
        # Ensure download directory exists
        Path(CLIENT_DOWNLOAD_DIR).mkdir(exist_ok=True)
        
        self.logger.info(f"Client initialized for {host}:{port}")
    
    def _setup_logging(self):
        """Configure logging to file and console"""
        Path(LOG_DIR).mkdir(exist_ok=True)
        
        log_filename = f"{LOG_DIR}/client_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_filename),
                logging.StreamHandler(sys.stdout)
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def calculate_checksum(self, filepath):
        """Calculate MD5 checksum of a file"""
        md5_hash = hashlib.md5()
        try:
            with open(filepath, 'rb') as f:
                for chunk in iter(lambda: f.read(BUFFER_SIZE), b''):
                    md5_hash.update(chunk)
            return md5_hash.hexdigest()
        except Exception as e:
            self.logger.error(f"Error calculating checksum: {e}")
            return None
    
    def connect_with_retry(self):
        """Connect to server with exponential backoff retry logic"""
        backoff = INITIAL_BACKOFF
        
        for attempt in range(1, MAX_RETRIES + 1):
            if shutdown_flag:
                return False
            
            try:
                self.logger.info(f"Connection attempt {attempt}/{MAX_RETRIES} to {self.host}:{self.port}")
                
                self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.socket.settimeout(10)  # 10 second timeout
                self.socket.connect((self.host, self.port))
                
                self.logger.info(f"Successfully connected to {self.host}:{self.port}")
                return True
                
            except (socket.timeout, ConnectionRefusedError, OSError) as e:
                self.logger.warning(f"Connection attempt {attempt} failed: {e}")
                
                if self.socket:
                    try:
                        self.socket.close()
                    except:
                        pass
                    self.socket = None
                
                if attempt < MAX_RETRIES:
                    self.logger.info(f"Retrying in {backoff} seconds...")
                    time.sleep(backoff)
                    backoff = min(backoff * 2, MAX_BACKOFF)  # Exponential backoff
                else:
                    self.logger.error("Max retries reached. Connection failed.")
                    return False
        
        return False
    
    def display_progress_bar(self, current, total, bar_length=50):
        """Display a real-time progress bar"""
        if total == 0:
            return
        
        percent = float(current) / total
        filled_length = int(bar_length * percent)
        bar = '█' * filled_length + '-' * (bar_length - filled_length)
        
        # Calculate speed and ETA
        mb_current = current / (1024 * 1024)
        mb_total = total / (1024 * 1024)
        
        sys.stdout.write(f'\r|{bar}| {percent*100:.1f}% ({mb_current:.2f}/{mb_total:.2f} MB)')
        sys.stdout.flush()
        
        if current >= total:
            sys.stdout.write('\n')
    
    def receive_file(self, filename):
        """Request and receive file from server"""
        try:
            # Send filename request
            filename_bytes = filename.encode('utf-8')
            self.socket.sendall(struct.pack('!I', len(filename_bytes)))
            self.socket.sendall(filename_bytes)
            
            self.logger.info(f"Requested file: {filename}")
            
            # Receive response
            response = self.socket.recv(5)
            if response == b'ERROR':
                error_msg = self.socket.recv(1024).decode('utf-8')
                self.logger.error(f"Server error: {error_msg}")
                print(f"\nError: {error_msg}")
                return False
            
            if response != b'OK':
                self.logger.error("Invalid server response")
                return False
            
            # Receive file metadata
            # Filename length and filename
            filename_length_data = self.socket.recv(4)
            filename_length = struct.unpack('!I', filename_length_data)[0]
            received_filename = self.socket.recv(filename_length).decode('utf-8')
            
            # File size
            file_size_data = self.socket.recv(8)
            file_size = struct.unpack('!Q', file_size_data)[0]
            
            # Checksum
            expected_checksum = self.socket.recv(32).decode('utf-8')
            
            self.logger.info(f"Receiving: {received_filename} ({file_size} bytes)")
            self.logger.info(f"Expected checksum: {expected_checksum}")
            
            print(f"\nDownloading: {received_filename}")
            print(f"Size: {file_size / (1024*1024):.2f} MB")
            
            # Receive file data
            filepath = os.path.join(CLIENT_DOWNLOAD_DIR, received_filename)
            bytes_received = 0
            
            with open(filepath, 'wb') as f:
                while bytes_received < file_size and not shutdown_flag:
                    remaining = file_size - bytes_received
                    chunk_size = min(BUFFER_SIZE, remaining)
                    
                    try:
                        chunk = self.socket.recv(chunk_size)
                        if not chunk:
                            raise Exception("Connection lost during transfer")
                        
                        f.write(chunk)
                        bytes_received += len(chunk)
                        
                        # Update progress bar
                        self.display_progress_bar(bytes_received, file_size)
                        
                    except socket.timeout:
                        self.logger.error("Socket timeout during file transfer")
                        raise
            
            if shutdown_flag:
                self.logger.warning("Transfer interrupted by shutdown signal")
                return False
            
            # Verify file integrity
            print("\nVerifying file integrity...")
            actual_checksum = self.calculate_checksum(filepath)
            
            if actual_checksum == expected_checksum:
                self.logger.info(f"File integrity verified: {actual_checksum}")
                print(f"✓ File downloaded successfully: {filepath}")
                print(f"✓ Checksum verified: {actual_checksum}")
                return True
            else:
                self.logger.error(f"Checksum mismatch! Expected: {expected_checksum}, Got: {actual_checksum}")
                print(f"✗ Checksum verification failed!")
                print(f"  Expected: {expected_checksum}")
                print(f"  Got:      {actual_checksum}")
                return False
                
        except socket.timeout:
            self.logger.error("Network timeout during file transfer")
            print("\n✗ Error: Network timeout")
            return False
        
        except Exception as e:
            self.logger.error(f"Error receiving file: {e}")
            print(f"\n✗ Error: {e}")
            return False
    
    def download(self, filename):
        """Main download method with connection and error handling"""
        try:
            # Connect with retry logic
            if not self.connect_with_retry():
                print("Failed to connect to server")
                return False
            
            # Receive the file
            success = self.receive_file(filename)
            
            return success
            
        except KeyboardInterrupt:
            self.logger.warning("Download interrupted by user")
            print("\n\nDownload interrupted by user")
            return False
        
        finally:
            self.close()
    
    def close(self):
        """Close the connection"""
        if self.socket:
            try:
                self.socket.close()
                self.logger.info("Connection closed")
            except:
                pass
            self.socket = None


def signal_handler(signum, frame):
    """Handle SIGINT for graceful shutdown"""
    global shutdown_flag
    print("\n\nReceived shutdown signal. Stopping client...")
    shutdown_flag = True


def main():
    global shutdown_flag
    
    # Parse command line arguments
    if len(sys.argv) < 2:
        print("Usage: python client.py <filename> [host] [port]")
        print(f"Example: python client.py myfile.txt {DEFAULT_HOST} {DEFAULT_PORT}")
        sys.exit(1)
    
    filename = sys.argv[1]
    host = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_HOST
    
    try:
        port = int(sys.argv[3]) if len(sys.argv) > 3 else DEFAULT_PORT
    except ValueError:
        print(f"Invalid port number. Using default: {DEFAULT_PORT}")
        port = DEFAULT_PORT
    
    # Register signal handler
    signal.signal(signal.SIGINT, signal_handler)
    
    print(f"\n{'='*60}")
    print(f"File Transfer Client")
    print(f"Server: {host}:{port}")
    print(f"Requesting: {filename}")
    print(f"Download directory: {CLIENT_DOWNLOAD_DIR}")
    print(f"{'='*60}\n")
    
    # Create client and download file
    client = FileTransferClient(host, port)
    success = client.download(filename)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
