#!/usr/bin/env python3
"""
Test setup script - Creates sample files for testing the file transfer system
"""

import os
import random
import string
from pathlib import Path

SERVER_FILES_DIR = "server_files"

def create_test_files():
    """Create various test files of different sizes"""
    
    # Ensure directory exists
    Path(SERVER_FILES_DIR).mkdir(exist_ok=True)
    
    print("Creating test files...")
    
    # 1. Small text file
    with open(f"{SERVER_FILES_DIR}/small.txt", 'w') as f:
        f.write("This is a small test file.\n")
        f.write("It contains just a few lines of text.\n")
        f.write("Perfect for quick testing!\n")
    print("✓ Created small.txt (< 1 KB)")
    
    # 2. Medium text file
    with open(f"{SERVER_FILES_DIR}/medium.txt", 'w') as f:
        for i in range(1000):
            f.write(f"Line {i}: " + ''.join(random.choices(string.ascii_letters + string.digits, k=50)) + "\n")
    print("✓ Created medium.txt (~50 KB)")
    
    # 3. Large binary file (1 MB)
    with open(f"{SERVER_FILES_DIR}/large.bin", 'wb') as f:
        f.write(os.urandom(1024 * 1024))  # 1 MB of random data
    print("✓ Created large.bin (1 MB)")
    
    # 4. Very large file (10 MB)
    with open(f"{SERVER_FILES_DIR}/verylarge.bin", 'wb') as f:
        for _ in range(10):
            f.write(os.urandom(1024 * 1024))  # 10 MB total
    print("✓ Created verylarge.bin (10 MB)")
    
    # 5. JSON test file
    with open(f"{SERVER_FILES_DIR}/data.json", 'w') as f:
        f.write('{\n')
        f.write('  "name": "Test Data",\n')
        f.write('  "version": "1.0",\n')
        f.write('  "items": [\n')
        for i in range(100):
            f.write(f'    {{"id": {i}, "value": "item_{i}"}},\n')
        f.write('  ]\n')
        f.write('}\n')
    print("✓ Created data.json (~2 KB)")
    
    print(f"\nTest files created in '{SERVER_FILES_DIR}/' directory")
    print("\nYou can now test with:")
    print("  py repository_after/client.py small.txt")
    print("  py repository_after/client.py medium.txt")
    print("  py repository_after/client.py large.bin")
    print("  py repository_after/client.py verylarge.bin")
    print("  py repository_after/client.py data.json")

if __name__ == "__main__":
    create_test_files()
