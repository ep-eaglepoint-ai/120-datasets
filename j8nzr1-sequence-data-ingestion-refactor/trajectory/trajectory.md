# Trajectory: Sequence-Data-Ingestion-Refactor

**Task Category**: Refactoring, Architecture Design, Robustness Engineering
**Goal**: The objective is to refactor an imperative, monolithic genomic file parser into an extensible Strategy-based architecture. This involves separating format-specific parsing logic from the main processing loop to support better error isolation, testability, and the future addition of new sequence types (e.g., BAM, CRAM) without modifying the core ingestion kernel.

---

## 1. Audit Current State

_Analyzing the legacy `ingest_processor.py` to identify failure modes and architectural rigidities._

- **Problems**:
  - **Logic Coupling**: Support for FASTQ and FASTA was hardcoded into a single `for` loop. Adding a new format (like BAM) would increase the cyclomatic complexity of this single loop, risking regressions in existing formats.
  - **Fragile State Handling**: The legacy code manually sliced lists or acted on specific characters (like `@`) without maintaining state. If a file had a formatting hiccup (e.g., a missing separator), the parser would likely crash or misinterpret subsequent records.
  - **Atomic Failure**: The system was "All or Nothing". A single `KeyError` or malformed line in a 1GB file would cause the entire batch to fail, requiring a full re-run.
  - **Implicit Buffering**: Batch sizes were loosely controlled, leading to potential memory spikes or timeout issues on large files.

## 2. Define the Contract

_Establishing the non-negotiable behaviors the new system must guarantee._

- **Constraints**:
  - **Fault Tolerance**: The system **must** survive bad records. If record #500 is corrupt, records #1-499 and #501-1000 must still be persisted.
  - **Memory Safety**: We cannot load the whole file into memory. Processing must be streaming, with a hard cap on buffer size (500 records) before flushing to DB.
  - **Type Safety**: Remove `dict` usage for internal data passing. Usage of a `SequenceRecord` dataclass is required to prevent downstream `KeyError`s.
- **Guarantees**:
  - **API Compatibility**: The resulting database entries must match the legacy format context (e.g., `sequencer_id` injection).
  - **Extension Rejection**: Files with unsupported extensions (e.g., `.LOG`) must trigger an immediate `UnsupportedFormatError` before any I/O occurs.

## 3. Structural Design

_Reworking the foundation to support the Strategy Pattern._

- **Architecture (Strategy Pattern)**:
  - **`ISequenceParser` (Interface)**: Defined a contract `parse(stream, context) -> Generator`. This decouples _how_ we read a file from _what_ we do with the data.
  - **`ParserFactory`**: Centralized logic for selecting the correct parser based on file extension. This satisfies the Open/Closed principle; we can add `BamParser` later without touching `ingest_processor.py`.
- **Data Model Changes**:
  - **`SequenceRecord`**: A frozen Data Transfer Object (DTO) that guarantees all required fields (`id`, `type`, `seq_id`) exist before they reach the database batcher.

## 4. Execution Pipeline

_The thought process behind the code transformation._

- **Step A: Stream Acquisition & Dispatch**:
  - Instead of reading the file into a giant string, I utilized `io.StringIO` (simulating a stream) to ensure the logic works on iterators.
  - The `ParserFactory` determines the strategy immediately. If the extension is invalid, we fail fast before allocating any buffers.
- **Step B: Robust Parsing Strategies**:
  - _The FASTQ Challenge_: FASTQ files consist of 4-line blocks. The legacy code failed here because it treated lines individually.
  - _The Fix_: I implemented a `while True` loop inside `FastqParser` that explicitly attempts to consume 4 lines at a time.
  - _Error Isolation_: By wrapping the 4-line consumption in a `try/except` block, I created a firebreak. If line 3 (the separator) is missing, we catch the specific error, log it, and continue the loop, attempting to find the next valid record start. This satisfies the "999 saved, 1 logged" requirement.
- **Step C: Buffered Ingestion Loop**:
  - The main `process_raw_file` function was simplified to a consumer. It iterates over the generator provided by the parser.
  - I enforced a specific generic batch size (`BATCH_SIZE = 500`). The logic accumulates records and `await db.save_batch` only when the limit is hit, flushing the remainder at the end.

## 5. Verification

_Confirming the contract was met through targeted testing._

- **Success Metrics**:
  - **Resilience**: A custom test case injected a record with a missing `+` separator. Validated that `db.save_batch` was called for the valid records surrounding it.
  - **strictness**: Validated that `.LOG` files throw exceptions immediately.
- **Validation Method**:
  - **Differential Testing**: The test suite `tests/test_ingestion.py` was designed to be run against both `repository_before` (where it fails) and `repository_after` (where it passes), proving that the refactor actually changed behavior to meet requirements.
