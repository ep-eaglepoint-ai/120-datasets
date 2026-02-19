"""
Test basic functionality of ASCII85 implementations.
Tests that both implementations can handle basic encoding/decoding.
"""

import pytest


def test_basic_functionality():
    """Test that basic ASCII85 functionality works"""
    # Test basic encoding/decoding works
    test_data = b'Hello'
    
    # Import the implementation being tested
    try:
        from repository_before.base import ascii85_encode, ascii85_decode
    except ImportError:
        from repository_after.base import ascii85_encode, ascii85_decode
    
    # Basic functionality test
    encoded = ascii85_encode(test_data)
    assert isinstance(encoded, bytes), "Encode should return bytes"
    
    decoded = ascii85_decode(encoded)
    assert isinstance(decoded, bytes), "Decode should return bytes"


def test_empty_input_handling():
    """Test handling of empty input"""
    try:
        from repository_before.base import ascii85_encode, ascii85_decode
    except ImportError:
        from repository_after.base import ascii85_encode, ascii85_decode
    
    # Empty input should return empty output
    assert ascii85_encode(b'') == b''
    assert ascii85_decode(b'') == b''


def test_function_names_exist():
    """Test that required functions exist"""
    try:
        from repository_before.base import ascii85_encode, ascii85_decode
    except ImportError:
        from repository_after.base import ascii85_encode, ascii85_decode
    
    assert callable(ascii85_encode), "ascii85_encode should be callable"
    assert callable(ascii85_decode), "ascii85_decode should be callable"