import struct

# Pre-computed powers of 85 for performance optimization
_POWERS_85 = [85**i for i in range(5)]

def _validate_input(data, operation):
    """Input validation to fail fast on invalid inputs"""
    if not isinstance(data, bytes):
        raise TypeError(f"{operation}: expected bytes, got {type(data)}")

def _base10_to_85_iterative(d: int) -> str:
    """Iterative base conversion - eliminates stack overflow risk"""
    if d <= 0:
        return ""
    result = []
    while d > 0:
        result.append(chr(d % 85 + 33))
        d //= 85
    return ''.join(result)

def _base85_to_10_optimized(digits: list) -> int:
    """Base85 to base10 conversion using pre-computed powers"""
    return sum(char * _POWERS_85[i] for i, char in enumerate(reversed(digits)))

def _chunk_bytes(data, chunk_size: int):
    """Efficient chunking without complex zip patterns"""
    for i in range(0, len(data), chunk_size):
        yield data[i:i + chunk_size]

def ascii85_encode(data: bytes) -> bytes:
    _validate_input(data, "ascii85_encode")
    if not data:
        return b''
    
    result = bytearray()
    padding = (4 - len(data) % 4) % 4
    padded_data = data + b'\x00' * padding
    
    for chunk in _chunk_bytes(padded_data, 4):
        value = struct.unpack('>I', chunk)[0]
        b85_str = _base10_to_85_iterative(value)
        b85_str = b85_str.ljust(5, chr(33))[::-1]
        result.extend(b85_str.encode('ascii'))
    
    if padding > 0:
        result = result[:-padding]
    return bytes(result)

def ascii85_decode(data: bytes) -> bytes:
    _validate_input(data, "ascii85_decode")
    if not data:
        return b''
    
    result = bytearray()
    padding = (5 - len(data) % 5) % 5
    padded_data = data + b'u' * padding
    
    for chunk in _chunk_bytes(padded_data, 5):
        digits = [byte - 33 for byte in chunk]
        value = _base85_to_10_optimized(digits)
        try:
            bytes_chunk = struct.pack('>I', value)
            result.extend(bytes_chunk)
        except struct.error:
            result.extend(b'\x00\x00\x00\x00')
    
    if padding > 0:
        result = result[:-padding]
    return bytes(result)

if __name__ == "__main__":
    import doctest
    doctest.testmod()