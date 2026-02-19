#!/usr/bin/env python3
"""
Automated test suite for the file transfer system
Tests server and client functionality
"""

import subprocess
import time
import os
import sys
import signal
from pathlib import Path

SERVER_FILES_DIR = "server_files"
CLIENT_DOWNLOAD_DIR = "client_downloads"
TEST_PORT = 9998

def cleanup():
    """Clean up test files and directories"""
    print("Cleaning up test environment...")
    
    # Remove client downloads
    if os.path.exists(CLIENT_DOWNLOAD_DIR):
        for file in Path(CLIENT_DOWNLOAD_DIR).glob("*"):
            try:
                file.unlink()
            except:
                pass
    
    print("✓ Cleanup complete")

def setup_test_files():
    """Create test files"""
    print("\n" + "="*60)
    print("Setting up test files...")
    print("="*60)
    
    result = subprocess.run([sys.executable, "test_setup.py"], 
                          capture_output=True, text=True)
    print(result.stdout)
    
    if result.returncode != 0:
        print("✗ Failed to create test files")
        return False
    
    return True

def start_server():
    """Start the server in background"""
    print("\n" + "="*60)
    print("Starting server...")
    print("="*60)
    
    server_process = subprocess.Popen(
        [sys.executable, "server.py", str(TEST_PORT)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # Wait for server to start
    time.sleep(2)
    
    if server_process.poll() is not None:
        print("✗ Server failed to start")
        return None
    
    print("✓ Server started on port", TEST_PORT)
    return server_process

def test_download(filename, expected_success=True):
    """Test downloading a file"""
    print(f"\nTesting download: {filename}")
    print("-" * 40)
    
    result = subprocess.run(
        [sys.executable, "client.py", filename, "localhost", str(TEST_PORT)],
        capture_output=True,
        text=True,
        timeout=30
    )
    
    success = result.returncode == 0
    
    if success and expected_success:
        print(f"✓ Successfully downloaded {filename}")
        
        # Verify file exists
        downloaded_file = os.path.join(CLIENT_DOWNLOAD_DIR, filename)
        if os.path.exists(downloaded_file):
            size = os.path.getsize(downloaded_file)
            print(f"  File size: {size} bytes")
            return True
        else:
            print(f"✗ Downloaded file not found: {downloaded_file}")
            return False
    
    elif not success and not expected_success:
        print(f"✓ Expected failure for {filename}")
        return True
    
    else:
        print(f"✗ Unexpected result for {filename}")
        print("STDOUT:", result.stdout[-200:] if len(result.stdout) > 200 else result.stdout)
        print("STDERR:", result.stderr[-200:] if len(result.stderr) > 200 else result.stderr)
        return False

def test_concurrent_downloads():
    """Test multiple concurrent downloads"""
    print("\n" + "="*60)
    print("Testing concurrent downloads...")
    print("="*60)
    
    files = ["small.txt", "medium.txt", "data.json"]
    processes = []
    
    # Start multiple clients
    for filename in files:
        proc = subprocess.Popen(
            [sys.executable, "client.py", filename, "localhost", str(TEST_PORT)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        processes.append((filename, proc))
        time.sleep(0.1)  # Small delay between starts
    
    # Wait for all to complete
    results = []
    for filename, proc in processes:
        try:
            proc.wait(timeout=30)
            success = proc.returncode == 0
            results.append((filename, success))
        except subprocess.TimeoutExpired:
            proc.kill()
            results.append((filename, False))
    
    # Check results
    all_success = all(success for _, success in results)
    
    for filename, success in results:
        status = "✓" if success else "✗"
        print(f"{status} {filename}")
    
    if all_success:
        print("\n✓ All concurrent downloads successful")
    else:
        print("\n✗ Some concurrent downloads failed")
    
    return all_success

def run_all_tests():
    """Run all tests"""
    print("\n" + "="*60)
    print("FILE TRANSFER SYSTEM - TEST SUITE")
    print("="*60)
    
    # Cleanup first
    cleanup()
    
    # Setup test files
    if not setup_test_files():
        print("\n✗ Test setup failed")
        return False
    
    # Start server
    server_process = start_server()
    if not server_process:
        print("\n✗ Failed to start server")
        return False
    
    try:
        # Run tests
        print("\n" + "="*60)
        print("Running download tests...")
        print("="*60)
        
        test_results = []
        
        # Test 1: Small file
        test_results.append(("Small file", test_download("small.txt")))
        
        # Test 2: Medium file
        test_results.append(("Medium file", test_download("medium.txt")))
        
        # Test 3: Large binary file
        test_results.append(("Large binary", test_download("large.bin")))
        
        # Test 4: JSON file
        test_results.append(("JSON file", test_download("data.json")))
        
        # Test 5: Non-existent file (should fail)
        test_results.append(("Non-existent file", test_download("nonexistent.txt", expected_success=False)))
        
        # Test 6: Concurrent downloads
        test_results.append(("Concurrent downloads", test_concurrent_downloads()))
        
        # Print summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for _, result in test_results if result)
        total = len(test_results)
        
        for test_name, result in test_results:
            status = "✓ PASS" if result else "✗ FAIL"
            print(f"{status}: {test_name}")
        
        print(f"\nResults: {passed}/{total} tests passed")
        
        if passed == total:
            print("\n🎉 All tests passed!")
            return True
        else:
            print(f"\n⚠️  {total - passed} test(s) failed")
            return False
    
    finally:
        # Stop server
        print("\n" + "="*60)
        print("Stopping server...")
        print("="*60)
        
        try:
            server_process.terminate()
            server_process.wait(timeout=5)
            print("✓ Server stopped")
        except:
            server_process.kill()
            print("✓ Server killed")

if __name__ == "__main__":
    try:
        success = run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Test suite error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
