#!/usr/bin/env python3
"""
File Transfer Server
Handles multiple concurrent clients using threading, sends files with progress tracking.
"""

import socket
import threading
import os
import sys
import signal
import logging
import hashlib
import struct
import time
from pathlib import Path
from datetime import datetime

# Configuration
DEFAULT_PORT = 9999
BUFFER_SIZE = 4096
SERVER_FILES_DIR = "server_files"
LOG_DIR = "logs"

# Global flag for graceful shutdown
shutdown_flag = threading.Event()

class FileTransferServer:
    def __init__(self, host='0.0.0.0', port=DEFAULT_PORT):
        self.host = host
        self.port = port
        self.server_socket = None
        self.active_connections = []
        self.lock = threading.Lock()
        
        # Setup logging
        self._setup_logging()
        
        # Ensure server files directory exists
        Path(SERVER_FILES_DIR).mkdir(exist_ok=True)
        
        self.logger.info(f"Server initialized on {host}:{port}")
    
    def _setup_logging(self):
        """Configure logging to file and console"""
        Path(LOG_DIR).mkdir(exist_ok=True)
        
        log_filename = f"{LOG_DIR}/server_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(threadName)s - %(levelname)s - %(message)s',
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
    
    def send_file(self, client_socket, filepath, client_addr):
        """Send file to client with progress tracking"""
        try:
            file_size = os.path.getsize(filepath)
            filename = os.path.basename(filepath)
            
            self.logger.info(f"Sending file '{filename}' ({file_size} bytes) to {client_addr}")
            
            # Calculate checksum
            checksum = self.calculate_checksum(filepath)
            if not checksum:
                raise Exception("Failed to calculate checksum")
            
            # Send file metadata: filename length, filename, file size, checksum
            filename_bytes = filename.encode('utf-8')
            metadata = struct.pack('!I', len(filename_bytes)) + filename_bytes
            metadata += struct.pack('!Q', file_size)
            metadata += checksum.encode('utf-8')
            
            client_socket.sendall(metadata)
            
            # Send file data
            bytes_sent = 0
            last_progress = 0
            
            with open(filepath, 'rb') as f:
                while bytes_sent < file_size and not shutdown_flag.is_set():
                    chunk = f.read(BUFFER_SIZE)
                    if not chunk:
                        break
                    
                    client_socket.sendall(chunk)
                    bytes_sent += len(chunk)
                    
                    # Log progress every 10%
                    progress = int((bytes_sent / file_size) * 100)
                    if progress >= last_progress + 10:
                        self.logger.info(f"Progress to {client_addr}: {progress}% ({bytes_sent}/{file_size} bytes)")
                        last_progress = progress
            
            self.logger.info(f"File '{filename}' sent successfully to {client_addr}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error sending file to {client_addr}: {e}")
            return False
    
    def handle_client(self, client_socket, client_addr):
        """Handle individual client connection"""
        self.logger.info(f"New connection from {client_addr}")
        
        try:
            # Receive requested filename
            filename_length_data = client_socket.recv(4)
            if not filename_length_data:
                return
            
            filename_length = struct.unpack('!I', filename_length_data)[0]
            filename = client_socket.recv(filename_length).decode('utf-8')
            
            self.logger.info(f"Client {client_addr} requested file: {filename}")
            
            # Check if file exists
            filepath = os.path.join(SERVER_FILES_DIR, filename)
            
            if not os.path.exists(filepath):
                self.logger.warning(f"File '{filename}' not found for {client_addr}")
                # Send error response
                client_socket.sendall(b'ERROR')
                error_msg = f"File '{filename}' not found on server"
                client_socket.sendall(error_msg.encode('utf-8'))
                return
            
            # Send success response
            client_socket.sendall(b'OK')
            
            # Send the file
            self.send_file(client_socket, filepath, client_addr)
            
        except Exception as e:
            self.logger.error(f"Error handling client {client_addr}: {e}")
        
        finally:
            client_socket.close()
            with self.lock:
                if client_socket in self.active_connections:
                    self.active_connections.remove(client_socket)
            self.logger.info(f"Connection closed with {client_addr}")
    
    def start(self):
        """Start the server"""
        try:
            self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.server_socket.bind((self.host, self.port))
            self.server_socket.listen(5)
            self.server_socket.settimeout(1.0)  # Timeout for checking shutdown flag
            
            self.logger.info(f"Server listening on {self.host}:{self.port}")
            print(f"\n{'='*60}")
            print(f"File Transfer Server Started")
            print(f"Listening on: {self.host}:{self.port}")
            print(f"Files directory: {SERVER_FILES_DIR}")
            print(f"Press Ctrl+C to stop")
            print(f"{'='*60}\n")
            
            while not shutdown_flag.is_set():
                try:
                    client_socket, client_addr = self.server_socket.accept()
                    
                    with self.lock:
                        self.active_connections.append(client_socket)
                    
                    # Handle client in a new thread
                    client_thread = threading.Thread(
                        target=self.handle_client,
                        args=(client_socket, client_addr),
                        daemon=True
                    )
                    client_thread.start()
                    
                except socket.timeout:
                    continue
                except Exception as e:
                    if not shutdown_flag.is_set():
                        self.logger.error(f"Error accepting connection: {e}")
        
        except Exception as e:
            self.logger.error(f"Server error: {e}")
        
        finally:
            self.shutdown()
    
    def shutdown(self):
        """Gracefully shutdown the server"""
        self.logger.info("Shutting down server...")
        
        # Close all active connections
        with self.lock:
            for conn in self.active_connections:
                try:
                    conn.close()
                except:
                    pass
            self.active_connections.clear()
        
        # Close server socket
        if self.server_socket:
            try:
                self.server_socket.close()
            except:
                pass
        
        self.logger.info("Server shutdown complete")


def signal_handler(signum, frame):
    """Handle SIGINT for graceful shutdown"""
    print("\n\nReceived shutdown signal. Stopping server...")
    shutdown_flag.set()


def main():
    # Parse command line arguments
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Invalid port number. Using default: {DEFAULT_PORT}")
            port = DEFAULT_PORT
    
    # Register signal handler
    signal.signal(signal.SIGINT, signal_handler)
    
    # Create and start server
    server = FileTransferServer(port=port)
    server.start()


if __name__ == "__main__":
    main()
