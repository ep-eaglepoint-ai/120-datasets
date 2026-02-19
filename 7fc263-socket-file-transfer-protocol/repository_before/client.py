#!/usr/bin/env python3
"""
Basic File Transfer Client - Initial Implementation
Simple client without retry logic or advanced features.
"""

import socket
import sys

# Basic configuration
DEFAULT_HOST = 'localhost'
DEFAULT_PORT = 9999
BUFFER_SIZE = 1024

def download_file(host, port, filename):
    """Download file from server - basic implementation"""
    try:
        # Connect to server
        client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client_socket.connect((host, port))
        
        # Send filename
        client_socket.send(filename.encode('utf-8'))
        
        # Receive response
        response = client_socket.recv(10).decode('utf-8')
        
        if response.startswith('OK'):
            print(f"Downloading {filename}...")
            
            # Receive file data
            with open(f"downloaded_{filename}", 'wb') as f:
                while True:
                    data = client_socket.recv(BUFFER_SIZE)
                    if not data:
                        break
                    f.write(data)
            
            print(f"File {filename} downloaded successfully")
            return True
            
        else:
            print(f"Error: File {filename} not found")
            return False
            
    except Exception as e:
        print(f"Error: {e}")
        return False
    finally:
        client_socket.close()

def main():
    # Parse arguments
    if len(sys.argv) < 2:
        print("Usage: python client.py <filename> [host] [port]")
        return
    
    filename = sys.argv[1]
    host = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_HOST
    port = int(sys.argv[3]) if len(sys.argv) > 3 else DEFAULT_PORT
    
    print(f"Connecting to {host}:{port}")
    download_file(host, port, filename)

if __name__ == "__main__":
    main()