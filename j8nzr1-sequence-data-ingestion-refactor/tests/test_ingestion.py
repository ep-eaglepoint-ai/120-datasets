import sys
import pytest
import logging
from unittest.mock import MagicMock, AsyncMock, call, ANY

# --- Mock Setup ---
# We must mock 'infra' before 'ingest_processor' is imported
infra_mock = MagicMock()
storage_mock = AsyncMock()
db_mock = AsyncMock()
monitoring_mock = AsyncMock()

infra_mock.storage = storage_mock
infra_mock.db = db_mock
infra_mock.monitoring = monitoring_mock

sys.modules['infra'] = infra_mock
sys.modules['infra.storage'] = storage_mock
sys.modules['infra.db'] = db_mock
sys.modules['infra.monitoring'] = monitoring_mock

# Import the module under test
# The PYTHONPATH is set by the runner to point to either repository_before or repository_after
try:
    import ingest_processor
except ImportError:
    # Logic to handle if path is not set correctly during development
    sys.path.append('repository_after')
    import ingest_processor
    # If using repository_after path, we assume we might need to mock infra differently if it was real?
    # No, mocks are in sys.modules, so it's fine.

@pytest.fixture(autouse=True)
def reset_mocks():
    storage_mock.reset_mock()
    db_mock.reset_mock()
    monitoring_mock.reset_mock()

@pytest.mark.asyncio
async def test_modular_architecture():
    """
    Check for separate Parser classes and Factory logic.
    Verify that the system selects the correct parser based on extension
    and supports case-insensitivity.
    """
    if not hasattr(ingest_processor, 'ISequenceParser'):
        pytest.fail("ISequenceParser interface missing")
    if not hasattr(ingest_processor, 'FastqParser'):
         pytest.fail("FastqParser missing")
    if not hasattr(ingest_processor, 'ParserFactory'):
         pytest.fail("ParserFactory missing")

    # Test Factory Logic
    # FASTQ
    parser_fastq = ingest_processor.ParserFactory.get_parser(".FASTQ")
    assert isinstance(parser_fastq, ingest_processor.FastqParser)
    parser_fastq_lower = ingest_processor.ParserFactory.get_parser(".fastq")
    assert isinstance(parser_fastq_lower, ingest_processor.FastqParser)

    # FASTA
    parser_fasta = ingest_processor.ParserFactory.get_parser(".FASTA")
    assert isinstance(parser_fasta, ingest_processor.FastaParser)

    # Unsupported
    with pytest.raises(ingest_processor.UnsupportedFormatError):
        ingest_processor.ParserFactory.get_parser(".BAM")

@pytest.mark.asyncio
async def test_fastq_corruption_recovery(caplog):
    """
    Requirement 2 & 6: Verify atomic error recovery, logging, and skipped counts.
    Ensures that processing continues despite errors and logs them correctly.
    Scale: 1000 records total (999 valid, 1 corrupt).
    """
    caplog.set_level("ERROR")

    # 1. Generate 999 Valid Records
    valid_records_part1 = []
    for i in range(500):
        valid_records_part1.append(f"@SEQ_{i}\nAAAA\n+\n!!!!")

    # 2. Insert 1 Corrupt Record (Missing Separator)
    # L1: @SEQ_BAD
    # L2: AAAA
    # L3: @SEQ_500 (Start of next valid record, missing + and quality)
    corrupt_record = "@SEQ_BAD\nAAAA"

    # 3. Generate Remaining Valid Records
    valid_records_part2 = []
    for i in range(500, 999): # 499 records
        valid_records_part2.append(f"@SEQ_{i}\nAAAA\n+\n!!!!")

    # Combine
    # Note: corrupt_record doesn't have a newline at end, but valid_records_part2[0] starts with @
    # So: ...AAAA\n@SEQ_500...
    # Parser reads:
    # L1: @SEQ_BAD
    # L2: AAAA
    # L3: @SEQ_500 (Next header).
    # validation: expects '+'. Found @SEQ_500.
    # Recovery: push_back(@SEQ_500). yield Error.

    file_content = "\n".join(valid_records_part1) + "\n" + corrupt_record + "\n" + "\n".join(valid_records_part2)

    storage_mock.read_file.return_value = file_content

    # Run
    await ingest_processor.process_raw_file("test.FASTQ", "seq_1", "user_1")

    # Verify DB writes
    saved_records = []
    for call_args in db_mock.save_batch.call_args_list:
        saved_records.extend(call_args.args[1])

    # Expect 999 valid records (0-499 and 500-999)
    assert len(saved_records) == 999

    ids = sorted([r['id'] for r in saved_records])
    expected_ids = sorted([f"SEQ_{i}" for i in range(999)])
    assert ids == expected_ids

    # Verify Monitoring
    # 1 corrupt record skipped.
    monitoring_mock.log_event.assert_called_with("INGEST_COMPLETE", {
        "user": "user_1", "processed": 999, "skipped": 1
    })

    # Verify Logs
    # Requirement 6: tests must assert exactly one error log or the exact error message.
    error_logs = [r for r in caplog.records if r.levelno == logging.ERROR]
    # We might have "Skipping record due to error: ..." logs.
    # The actual log call in ingest_processor.py is:
    # logger.error(f"Skipping record due to error: {result}")
    
    skipper_logs = [log.message for log in error_logs if "Skipping record due to error" in log.message]
    assert len(skipper_logs) == 1
    assert "Malformed FASTQ record: Expected '+' separator. Found: '@SEQ_500...'" in skipper_logs[0]


@pytest.mark.asyncio
async def test_fastq_corruption_recovery_three_line_record_missing_quality(caplog):
    """
    Requirement 6 edge-case coverage (per review comment):

    FASTQ records are 4 lines: header, sequence, '+', quality.
    Inject a corrupted 3-line record (header + sequence + '+') missing only the
    4th quality line, in the middle of a 1000-record set.

    Expected:
    - 999 records saved
    - 1 record skipped
    - error logged, processing continues
    """
    caplog.set_level("ERROR")

    # 1. Generate 999 Valid Records
    valid_records_part1 = []
    for i in range(500):
        valid_records_part1.append(f"@SEQ_{i}\nAAAA\n+\n!!!!")

    # 2. Insert 1 Corrupt Record (3 lines only: header + sequence + '+', missing quality)
    # L1: @SEQ_BAD
    # L2: AAAA
    # L3: +
    # L4: @SEQ_500 (Start of next valid record, used as the (missing) quality line)
    corrupt_record = "@SEQ_BAD\nAAAA\n+"

    # 3. Generate Remaining Valid Records
    valid_records_part2 = []
    for i in range(500, 999):  # 499 records
        valid_records_part2.append(f"@SEQ_{i}\nAAAA\n+\n!!!!")

    file_content = (
        "\n".join(valid_records_part1)
        + "\n"
        + corrupt_record
        + "\n"
        + "\n".join(valid_records_part2)
    )

    storage_mock.read_file.return_value = file_content

    # Run
    await ingest_processor.process_raw_file("test.FASTQ", "seq_1", "user_1")

    # Verify DB writes
    saved_records = []
    for call_args in db_mock.save_batch.call_args_list:
        saved_records.extend(call_args.args[1])

    assert len(saved_records) == 999

    ids = sorted([r['id'] for r in saved_records])
    expected_ids = sorted([f"SEQ_{i}" for i in range(999)])
    assert ids == expected_ids

    # Verify Monitoring
    monitoring_mock.log_event.assert_called_with("INGEST_COMPLETE", {
        "user": "user_1", "processed": 999, "skipped": 1
    })

    # Verify Logs
    # Requirement 6 compliance here too
    error_logs = [r for r in caplog.records if r.levelno == logging.ERROR]
    skipper_logs = [log.message for log in error_logs if "Skipping record due to error" in log.message]
    assert len(skipper_logs) == 1
    # Quality line was actually the next header "@SEQ_500" (len 8), sequence is "AAAA" (len 4)
    assert "Malformed FASTQ record: Quality length (8) != Sequence length (4)." in skipper_logs[0]

@pytest.mark.asyncio
async def test_context_enrichment():
    """
    Ensure metadata is preserved for both FASTQ and FASTA.
    """
    # Test FASTQ
    storage_mock.read_file.return_value = "@SEQ_1\nAAAA\n+\n!!!!"
    await ingest_processor.process_raw_file("test.FASTQ", "seq_fastq", "user_1")
    saved_fastq = db_mock.save_batch.call_args[0][1][0]
    assert saved_fastq['seq_id'] == "seq_fastq"
    assert saved_fastq['type'] == "FASTQ"

    db_mock.reset_mock()

    # Test FASTA (Assuming FastaParser extracts headers >)
    # FastaParser implementation: yields SequenceRecord(id=line[1:], type="FASTA", created_at=datetime.now().isoformat())
    storage_mock.read_file.return_value = ">SEQ_FASTA\nACGTACGT"
    await ingest_processor.process_raw_file("test.FASTA", "seq_fasta", "user_1")
    saved_fasta = db_mock.save_batch.call_args[0][1][0]

    assert saved_fasta['id'] == "SEQ_FASTA"
    assert saved_fasta['type'] == "FASTA"
    # Ensure created_at is present (FastaParser specific)
    assert 'created_at' in saved_fasta
    assert saved_fasta['created_at'] is not None

@pytest.mark.asyncio
async def test_type_integrity():
    """
    Check for strict data models and dictionary cleaning.
    """
    # 1. Test Data Model Direct Instantiation
    record = ingest_processor.SequenceRecord(id="test", type="TEST")
    # Verify defaults
    assert record.seq_id is None
    data = record.to_dict()
    assert "seq_id" not in data # Should be filtered out
    assert data['id'] == "test"

    record_full = ingest_processor.SequenceRecord(id="test2", type="TEST", seq_id="S1")
    data_full = record_full.to_dict()
    assert data_full['seq_id'] == "S1"

    # 2. Verify Validation Logic (if any)
    # Python dataclasses don't strictly enforce types at runtime on init,
    # but we can check if the system handles missing required args
    with pytest.raises(TypeError):
        ingest_processor.SequenceRecord(type="TEST") # Missing ID

@pytest.mark.asyncio
async def test_buffer_management():
    """
    Verify batch flushing (e.g. every 500 lines).
    """
    records = []
    for i in range(1200):
        records.append(f"@SEQ_{i}\nAAAA\n+\n!!!!")

    file_content = "\n".join(records)
    storage_mock.read_file.return_value = file_content

    await ingest_processor.process_raw_file("test.FASTQ", "seq_1", "user_1")

    # 1200 records -> batch 500 -> 3 batches (500, 500, 200).
    # Legacy (1000) -> 2 batches (1000, 200).
    assert db_mock.save_batch.call_count == 3
    assert len(db_mock.save_batch.call_args_list[0].args[1]) == 500

@pytest.mark.asyncio
async def test_unknown_extension():
    """
    Verify that passing an unknown extension (e.g., .LOG)
    results in an 'UnsupportedFormatError'.
    """
    storage_mock.read_file.return_value = "some content"

    with pytest.raises(ingest_processor.UnsupportedFormatError):
        await ingest_processor.process_raw_file("test.LOG", "seq_1", "user_1")

    assert db_mock.save_batch.call_count == 0
    # Requirement 7: Assert storage.read_file was never called for unknown extension
    assert storage_mock.read_file.call_count == 0

@pytest.mark.asyncio
async def test_performance_empty_lines(caplog):
    """
    Requirement 8: Demonstrate performance impact.
    Process a larger file with alternating empty lines.
    Ensures zero interaction overhead (no errors logged, no skipped counts).
    """
    import time
    caplog.set_level("ERROR")

    records = []
    # 1000 records, interwoven with empty lines
    for i in range(1000):
        records.append(f"\n\n@SEQ_{i}\n\nAAAA\n\n+\n\n!!!!\n")

    file_content = "".join(records)
    storage_mock.read_file.return_value = file_content

    start_time = time.perf_counter()
    await ingest_processor.process_raw_file("test.FASTQ", "seq_1", "user_1")
    end_time = time.perf_counter()

    # Requirement 8: Assert no redundant IO (single read_file call)
    assert storage_mock.read_file.call_count == 1

    # Max 2 seconds for 1000 records (generous, should be <0.1s in mock)
    execution_time = end_time - start_time
    print(f"\nPerformance: Processed 1000 records (with 4000+ empty lines) in {execution_time:.4f}s")

    # Soft assertion on time to prevent regression
    assert execution_time < 2.0

    saved_records = []
    for call_args in db_mock.save_batch.call_args_list:
        saved_records.extend(call_args.args[1])

    assert len(saved_records) == 1000

    # Critical: Ensure NO errors were logged for empty lines
    assert len(caplog.records) == 0

    monitoring_mock.log_event.assert_called_with("INGEST_COMPLETE", {
        "user": "user_1", "processed": 1000, "skipped": 0
    })
