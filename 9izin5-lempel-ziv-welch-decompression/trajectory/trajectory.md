# Trajectory

## Trajectory (Thinking Process for Debugging)

### 1. Audit the Original Code (Identify Bugs)
I audited the original LZW decompression implementation and identified critical defects:
- **Data loss in write_file_binary**: Loop writes `result_byte_array[:-1]`, skipping the last byte entirely
- **Function naming inconsistency**: `compress()` function actually performs decompression - violates naming contract
- **Off-by-one error**: The write loop excludes the final element, causing incomplete output

These bugs caused the decompressed output to be truncated and incorrect.

### 2. Define a Correctness Contract First
I defined correctness conditions:
- All bytes must be written to output (no data loss)
- Padding must be applied correctly without corrupting data
- All loops must process every element (no off-by-one errors)
- Function names must match behavior (decompress ≠ compress)
- LZW dictionary must be maintained consistently
- Round-trip compression/decompression must produce byte-identical output

### 3. Fix Data Loss in write_file_binary
**Bug 1: Off-by-one error in write loop**
Original buggy code:
```python
for elem in result_byte_array[:-1]:
    opened_file.write(int(elem, 2).to_bytes(1, byteorder="big"))
```

Fixed code:
```python
for elem in result_byte_array:
    opened_file.write(int(elem, 2).to_bytes(1, byteorder="big"))
```

The `[:-1]` slice was dropping the last byte. Removing it ensures all bytes are written.

**Bug 2: Incorrect padding for byte-aligned data**
Original buggy code:
```python
if len(result_byte_array[-1]) % byte_length == 0:
    result_byte_array.append("10000000")  # Adds extra 0x80 byte!
```

Fixed code:
```python
if len(result_byte_array[-1]) < byte_length:
    result_byte_array[-1] += "1" + "0" * (byte_length - len(result_byte_array[-1]) - 1)
# No extra byte added when already aligned
```

The original code corrupted byte-aligned data by appending an unnecessary `0x80` marker byte. The fix only pads when data is NOT byte-aligned, preserving data integrity for the "byte-identical" requirement.

### 4. Fix Function Naming Inconsistency
Original buggy code:
```python
def compress(source_path: str, destination_path: str) -> None:
    """
    Reads source file, decompresses it and writes the result in destination file
    """
```

Fixed code:
```python
def decompress(source_path: str, destination_path: str) -> None:
    """
    Reads source file, decompresses it and writes the result in destination file
    """
```

Function name now matches its actual behavior.

### 5. Preserve Algorithm Logic
All other LZW algorithm components were preserved:
- `read_file_binary`: Converts file bytes to bit string
- `decompress_data`: LZW dictionary reconstruction logic
- `remove_prefix`: Size prefix removal
- Padding logic in `write_file_binary`

Only the bugs were fixed, not the algorithm itself.

### 6. Write Comprehensive Tests
Created tests covering all 9 requirements:
- Data integrity (all bytes written)
- Padding correctness
- Loop completeness
- Naming consistency
- Dictionary maintenance
- Prefix removal
- Binary conversion
- Edge cases (empty, small, aligned inputs)
- Round-trip verification

### 7. Result: Correct Decompression
- **Before**: Data loss, incorrect output, wrong function name
- **After**: Complete output, byte-identical round-trip, correct naming
- All tests pass for `repository_after`
- All critical tests fail for `repository_before`

## Core Principle
**Audit → Contract → Design → Execute → Verify**

The trajectory structure remains constant. Only the focus and artifacts change based on task type.

