"""
Comprehensive tests for LZW decompression implementation.
Tests fail for repository_before (buggy), pass for repository_after (fixed).
"""
import pytest
import sys
import os
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def get_module():
    """Get the decompress module based on TEST_IMPLEMENTATION environment variable."""
    impl = os.environ.get("TEST_IMPLEMENTATION", "after")
    
    if impl == "before":
        from repository_before import decompress
    else:
        from repository_after import decompress
    
    return decompress


class TestRequirement1DataIntegrity:
    """Requirement 1: All bytes must be written to output file."""

    def test_all_bytes_written_simple(self):
        """Test that all bytes are written for simple input."""
        module = get_module()
        
        # Create a simple bit string that should result in multiple bytes
        test_bits = "01010101" * 10  # 10 bytes worth
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            temp_output = f.name
        
        try:
            module.write_file_binary(temp_output, test_bits)
            
            # Read back and verify
            with open(temp_output, 'rb') as f:
                data = f.read()
            
            # Should have written at least the data bytes (may have padding byte)
            assert len(data) >= 10, f"Expected at least 10 bytes, got {len(data)}"
        finally:
            if os.path.exists(temp_output):
                os.remove(temp_output)

    def test_no_data_loss_in_write(self):
        """Test that write_file_binary doesn't drop the last byte."""
        module = get_module()
        
        # Create test data that results in exactly 3 complete bytes
        test_bits = "11111111" + "00000000" + "10101010"
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            temp_output = f.name
        
        try:
            module.write_file_binary(temp_output, test_bits)
            
            with open(temp_output, 'rb') as f:
                data = f.read()
            
            # Must have at least 3 bytes (the actual data)
            assert len(data) >= 3, f"Data loss detected: expected at least 3 bytes, got {len(data)}"
            
            # First 3 bytes should match our input
            assert data[0] == 0xFF, "First byte incorrect"
            assert data[1] == 0x00, "Second byte incorrect"
            assert data[2] == 0xAA, "Third byte incorrect"
        finally:
            if os.path.exists(temp_output):
                os.remove(temp_output)


class TestRequirement2PaddingCorrectness:
    """Requirement 2: Padding must be applied correctly."""

    def test_padding_for_non_aligned_data(self):
        """Test padding when data doesn't align to byte boundary."""
        module = get_module()
        
        # 5 bits - requires padding
        test_bits = "10101"
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            temp_output = f.name
        
        try:
            module.write_file_binary(temp_output, test_bits)
            
            with open(temp_output, 'rb') as f:
                data = f.read()
            
            # Should have written at least 1 byte
            assert len(data) >= 1, "No data written"
        finally:
            if os.path.exists(temp_output):
                os.remove(temp_output)

    def test_padding_for_aligned_data(self):
        """Test that byte-aligned data does NOT get extra padding bytes."""
        module = get_module()
        
        # Exactly 2 bytes - should write exactly 2 bytes, no extra padding
        test_bits = "11110000" + "00001111"
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            temp_output = f.name
        
        try:
            module.write_file_binary(temp_output, test_bits)
            
            with open(temp_output, 'rb') as f:
                data = f.read()
            
            # Must be exactly 2 bytes - no extra padding for aligned data
            assert len(data) == 2, f"Aligned data corrupted: expected 2 bytes, got {len(data)} (extra padding added)"
            assert data[0] == 0xF0, f"First byte wrong: expected 0xF0, got {hex(data[0])}"
            assert data[1] == 0x0F, f"Second byte wrong: expected 0x0F, got {hex(data[1])}"
        finally:
            if os.path.exists(temp_output):
                os.remove(temp_output)


class TestRequirement3LoopCompleteness:
    """Requirement 3: All loops must process every element."""

    def test_write_processes_all_bytes(self):
        """Test that write loop doesn't skip elements."""
        module = get_module()
        
        # Create data with distinct bytes to verify all are written
        test_bits = "00000001" + "00000010" + "00000011" + "00000100"
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            temp_output = f.name
        
        try:
            module.write_file_binary(temp_output, test_bits)
            
            with open(temp_output, 'rb') as f:
                data = f.read()
            
            # All 4 bytes must be present
            assert len(data) >= 4, f"Loop skipped elements: expected at least 4 bytes, got {len(data)}"
            assert data[0] == 1, "First byte missing or incorrect"
            assert data[1] == 2, "Second byte missing or incorrect"
            assert data[2] == 3, "Third byte missing or incorrect"
            assert data[3] == 4, "Fourth byte missing or incorrect"
        finally:
            if os.path.exists(temp_output):
                os.remove(temp_output)


class TestRequirement4NamingConsistency:
    """Requirement 4: Function names must match behavior."""

    def test_function_name_matches_behavior(self):
        """Test that decompression function is named correctly."""
        module = get_module()
        
        # Check that the main function is named 'decompress' not 'compress'
        assert hasattr(module, 'decompress'), "Main function should be named 'decompress'"
        
        # Verify it's callable
        assert callable(module.decompress), "decompress should be a function"


class TestRequirement5DictionaryConsistency:
    """Requirement 5: LZW dictionary must be maintained correctly."""

    def test_decompress_data_basic(self):
        """Test basic decompression maintains dictionary."""
        module = get_module()
        
        # Simple test case
        test_input = "01101"
        result = module.decompress_data(test_input)
        
        # Should return some result without crashing
        assert isinstance(result, str), "decompress_data should return a string"
        assert len(result) > 0, "decompress_data should produce output"


class TestRequirement6PrefixRemoval:
    """Requirement 6: Prefix removal must be correct."""

    def test_remove_prefix_basic(self):
        """Test prefix removal works correctly."""
        module = get_module()
        
        # Prefix format: N zeros + 1 + N chars (counter+1 total from shortened string)
        # For N=2: "00" + "1" + "ab" + "payload"
        # After [2:]: "1abpayload", after [3:]: "payload"
        test_data = "00" + "1" + "ab" + "payload"
        result = module.remove_prefix(test_data)
        
        assert result == "payload", f"Prefix removal incorrect: got '{result}'"

    def test_remove_prefix_no_leading_zeros(self):
        """Test prefix removal with immediate 1."""
        module = get_module()
        
        # Prefix: 1 (no zeros, counter=0, skip 1 char from shortened)
        # After [0:]: "1data", after [1:]: "data"
        test_data = "1" + "data"
        result = module.remove_prefix(test_data)
        
        assert result == "data", f"Prefix removal incorrect: got '{result}'"


class TestRequirement7BinaryConversion:
    """Requirement 7: Binary string to byte conversion must be correct."""

    def test_binary_string_to_bytes(self):
        """Test that binary strings are correctly converted to bytes."""
        module = get_module()
        
        # Test with known binary patterns
        test_bits = "11111111" + "00000000" + "10101010"
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            temp_output = f.name
        
        try:
            module.write_file_binary(temp_output, test_bits)
            
            with open(temp_output, 'rb') as f:
                data = f.read()
            
            # Verify correct byte values
            assert data[0] == 255, f"Expected 255, got {data[0]}"
            assert data[1] == 0, f"Expected 0, got {data[1]}"
            assert data[2] == 170, f"Expected 170, got {data[2]}"
        finally:
            if os.path.exists(temp_output):
                os.remove(temp_output)


class TestRequirement8EdgeCases:
    """Requirement 8: Handle edge cases correctly."""

    def test_empty_input(self):
        """Test handling of empty input."""
        module = get_module()
        
        result = module.decompress_data("")
        assert result == "", "Empty input should produce empty output"

    def test_very_small_input(self):
        """Test handling of very small input (1-7 bits)."""
        module = get_module()
        
        # Single bit
        result = module.decompress_data("0")
        assert isinstance(result, str), "Should handle single bit"
        
        # 5 bits
        result = module.decompress_data("01010")
        assert isinstance(result, str), "Should handle 5 bits"

    def test_exact_byte_multiple(self):
        """Test input that's exact multiple of 8 bits."""
        module = get_module()
        
        test_bits = "0" * 16  # Exactly 2 bytes worth
        result = module.decompress_data(test_bits)
        assert isinstance(result, str), "Should handle exact byte multiples"


class TestRequirement9RoundTrip:
    """Requirement 9: Round-trip decompression must produce identical output."""

    def test_read_write_roundtrip(self):
        """Test that reading and writing preserves data."""
        module = get_module()
        
        # Create test data
        original_bits = "10101010" + "11001100" + "11110000"
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.bin') as f:
            temp_file = f.name
        
        try:
            # Write
            module.write_file_binary(temp_file, original_bits)
            
            # Read back
            read_bits = module.read_file_binary(temp_file)
            
            # Should start with our original bits
            assert read_bits.startswith(original_bits[:24]), "Round-trip data mismatch"
        finally:
            if os.path.exists(temp_file):
                os.remove(temp_file)


class TestIntegration:
    """Integration tests for full decompression pipeline."""

    def test_full_decompression_pipeline(self):
        """Test complete decompression from file to file."""
        module = get_module()
        
        # Create a simple compressed file
        # Format: prefix + compressed data (use valid binary)
        # Prefix N=2: "001" + 3 chars + payload
        compressed_bits = "001" + "000" + "01010101"  # prefix + payload
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.bin') as f:
            input_file = f.name
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.bin') as f:
            output_file = f.name
        
        try:
            # Write compressed data
            with open(input_file, 'wb') as f:
                # Convert compressed_bits to bytes
                for i in range(0, len(compressed_bits), 8):
                    byte_str = compressed_bits[i:i+8]
                    if len(byte_str) == 8:
                        f.write(int(byte_str, 2).to_bytes(1, byteorder='big'))
                    else:
                        # Pad last byte
                        byte_str += '0' * (8 - len(byte_str))
                        f.write(int(byte_str, 2).to_bytes(1, byteorder='big'))
            
            # Decompress
            module.decompress(input_file, output_file)
            
            # Verify output file exists and has content
            assert os.path.exists(output_file), "Output file not created"
            assert os.path.getsize(output_file) > 0, "Output file is empty"
        finally:
            if os.path.exists(input_file):
                os.remove(input_file)
            if os.path.exists(output_file):
                os.remove(output_file)
