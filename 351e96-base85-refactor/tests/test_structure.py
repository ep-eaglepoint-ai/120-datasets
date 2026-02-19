"""
Test structural improvements in the refactored ASCII85 implementation.
Validates that performance optimizations and code quality improvements are present.
"""

import os
import re


BEFORE_PATH = "repository_before/base.py"
AFTER_PATH = "repository_after/base.py"


def _read_file(path):
    """Read file content"""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def test_helper_functions_exist():
    """
    Refactor requirement: Helper functions must exist in repository_after
    """
    # Determine which module to test based on PYTHONPATH
    pythonpath = os.environ.get('PYTHONPATH', '')
    if 'repository_before' in pythonpath:
        import repository_before.base as mod
    else:
        import repository_after.base as mod
    
    helpers = [
        name for name in dir(mod)
        if name.startswith("_") and callable(getattr(mod, name))
    ]
    
    # Should have at least 3 helper functions
    assert len(helpers) >= 3, f"Expected at least 3 helper functions, found {len(helpers)}: {helpers}"


def test_iterative_base_conversion():
    """
    Performance requirement: Recursive _base10_to_85 should be replaced with iterative version
    """
    # Determine which module to test based on PYTHONPATH
    pythonpath = os.environ.get('PYTHONPATH', '')
    if 'repository_before' in pythonpath:
        import repository_before.base as mod
    else:
        import repository_after.base as mod
    
    # Check that iterative function exists
    assert hasattr(mod, '_base10_to_85_iterative'), "Missing _base10_to_85_iterative function"
    
    # Verify it's not recursive (no self-calls)
    import inspect
    source = inspect.getsource(mod._base10_to_85_iterative)
    assert '_base10_to_85_iterative' not in source.replace('def _base10_to_85_iterative', ''), \
        "Function should not call itself (should be iterative)"


def test_precomputed_powers():
    """
    Performance requirement: Powers of 85 should be pre-computed
    """
    # Determine which module to test based on PYTHONPATH
    pythonpath = os.environ.get('PYTHONPATH', '')
    if 'repository_before' in pythonpath:
        import repository_before.base as mod
    else:
        import repository_after.base as mod
    
    # Check for pre-computed powers
    assert hasattr(mod, '_POWERS_85'), "Missing pre-computed _POWERS_85"
    
    # Verify it contains the right values
    powers = getattr(mod, '_POWERS_85')
    expected = [85**i for i in range(5)]
    assert powers == expected, f"Wrong powers computed: {powers} != {expected}"


def test_struct_module_usage():
    """
    Performance requirement: Should use struct module for binary operations
    """
    # Determine which module to test based on PYTHONPATH
    pythonpath = os.environ.get('PYTHONPATH', '')
    if 'repository_before' in pythonpath:
        import repository_before.base as mod
        file_path = "repository_before/base.py"
    else:
        import repository_after.base as mod
        file_path = "repository_after/base.py"
    
    content = _read_file(file_path)
    
    # Should import and use struct
    assert 'import struct' in content, "Should import struct module"
    assert 'struct.pack' in content, "Should use struct.pack"
    assert 'struct.unpack' in content, "Should use struct.unpack"


def test_input_validation():
    """
    Robustness requirement: Should have input validation
    """
    # Determine which module to test based on PYTHONPATH
    pythonpath = os.environ.get('PYTHONPATH', '')
    if 'repository_before' in pythonpath:
        import repository_before.base as mod
    else:
        import repository_after.base as mod
    
    # Check for validation function
    assert hasattr(mod, '_validate_input'), "Missing _validate_input function"


def test_efficient_chunking():
    """
    Performance requirement: Should use efficient chunking instead of complex zip patterns
    """
    # Determine which module to test based on PYTHONPATH
    pythonpath = os.environ.get('PYTHONPATH', '')
    if 'repository_before' in pythonpath:
        import repository_before.base as mod
        file_path = "repository_before/base.py"
    else:
        import repository_after.base as mod
        file_path = "repository_after/base.py"
    
    content = _read_file(file_path)
    
    # After should not use the complex zip pattern
    assert 'zip(*[iter(' not in content, "Should not use complex zip(*[iter()] pattern"
    
    # Should have chunking function
    assert hasattr(mod, '_chunk_bytes'), "Missing _chunk_bytes function"


def test_reduced_string_operations():
    """
    Performance requirement: Should reduce redundant string operations
    """
    # Determine which module to test based on PYTHONPATH
    pythonpath = os.environ.get('PYTHONPATH', '')
    if 'repository_before' in pythonpath:
        import repository_before.base as mod
        file_path = "repository_before/base.py"
    else:
        import repository_after.base as mod
        file_path = "repository_after/base.py"
    
    content = _read_file(file_path)
    
    # Should use bytearray for efficiency
    assert 'bytearray' in content, "Should use bytearray for efficient operations"


def test_no_utf8_decode_encode_cycles():
    """
    Performance requirement: Should avoid unnecessary UTF-8 decode/encode cycles
    """
    after_content = _read_file(AFTER_PATH)
    
    # Count decode/encode operations in main functions
    encode_func = re.search(r'def ascii85_encode.*?(?=def|\Z)', after_content, re.DOTALL)
    decode_func = re.search(r'def ascii85_decode.*?(?=def|\Z)', after_content, re.DOTALL)
    
    if encode_func:
        encode_body = encode_func.group(0)
        # Should not have decode("utf-8") in encode function
        assert '.decode("utf-8")' not in encode_body, "Encode function should not decode UTF-8"
    
    if decode_func:
        decode_body = decode_func.group(0)
        # Minimal UTF-8 operations in decode
        utf8_ops = decode_body.count('.decode("utf-8")') + decode_body.count('.encode("utf-8")')
        assert utf8_ops <= 1, f"Too many UTF-8 operations in decode: {utf8_ops}"


def test_line_count_reasonable():
    """
    Maintainability requirement: Refactor should not excessively increase line count
    """
    before_lines = len(_read_file(BEFORE_PATH).splitlines())
    after_lines = len(_read_file(AFTER_PATH).splitlines())
    
    # Allow reasonable growth for helper functions and documentation
    assert after_lines <= before_lines + 50, f"Too many lines added: {after_lines} vs {before_lines}"


def test_docstring_preservation():
    """
    Compatibility requirement: Main function docstrings should be preserved
    """
    before_content = _read_file(BEFORE_PATH)
    after_content = _read_file(AFTER_PATH)
    
    # Extract docstrings from main functions
    encode_docstring_before = re.search(r'def ascii85_encode.*?"""(.*?)"""', before_content, re.DOTALL)
    encode_docstring_after = re.search(r'def ascii85_encode.*?"""(.*?)"""', after_content, re.DOTALL)
    
    if encode_docstring_before and encode_docstring_after:
        # Doctests should be preserved
        assert '>>>' in encode_docstring_after.group(1), "Doctests should be preserved in encode function"
    
    decode_docstring_before = re.search(r'def ascii85_decode.*?"""(.*?)"""', before_content, re.DOTALL)
    decode_docstring_after = re.search(r'def ascii85_decode.*?"""(.*?)"""', after_content, re.DOTALL)
    
    if decode_docstring_before and decode_docstring_after:
        # Doctests should be preserved  
        assert '>>>' in decode_docstring_after.group(1), "Doctests should be preserved in decode function"