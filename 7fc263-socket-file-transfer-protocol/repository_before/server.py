#!/usr/bin/env python3
"""
Basic File Transfer Server - Initial Implementation
Simple single-threaded server without advanced features.
"""

import socket
import os
import sys

# Basic configuration
DEFAULT_PORT = 9999
BUFFER_SIZE = 1024

def send_file(client_socket, filepath):
    """Send file to client - basic implementation"""
    try:
        with open(filepath, 'rb') as f:
            while True:
                data = f.read(BUFFER_SIZE)
                if not data:
                    break
                client_socket.send(data)
        return True
    except Exception as e:
        print(f"Error sending file: {e}")
        return False

def handle_client(client_socket, client_addr):
    """Handle client connection - basic implementation"""
    try:
        # Receive filename
        filename = client_socket.recv(1024).decode('utf-8')
        print(f"Client {client_addr} requested: {filename}")
        
        # Check if file exists
        if os.path.exists(filename):
            # Send OK response
            client_socket.send(b'OK')
            # Send file
            send_file(client_socket, filename)
        else:
            # Send error response
            client_socket.send(b'ERROR')
            
    except Exception as e:
        print(f"Error handling client: {e}")
    finally:
        client_socket.close()

def main():
    # Parse port
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("Invalid port number")
            return
    
    # Create server socket
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.bind(('localhost', port))
    server_socket.listen(1)
    
    print(f"Server listening on port {port}")
    
    try:
        while True:
            client_socket, client_addr = server_socket.accept()
            print(f"Connection from {client_addr}")
            handle_client(client_socket, client_addr)
    except KeyboardInterrupt:
        print("\nServer stopped")
    finally:
        server_socket.close()

if __name__ == "__main__":
    main()