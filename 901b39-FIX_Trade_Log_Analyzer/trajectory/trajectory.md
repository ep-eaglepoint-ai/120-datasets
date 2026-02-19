## 1. Audit the Original Code / Problem

**Before (`repository_before/`)**:
- Parser and ingestion are allocation-heavy (`split('|')`, `to_string`, `Vec<String>` per message) and synchronized via `Mutex` around all hot data (`messages`, `stats`, `seen_order_ids`).
- Stores full messages and a growing list of order IDs, which makes memory effectively **unbounded**.
- Parsing is not escape-aware: a literal pipe inside values (encoded as `\\|`) will be split incorrectly (notably fields like tag **11** and **58**).
- Report generation holds locks and scans stored messages, which blocks ingestion.

**After / Implemented Solution (`repository_after/`)**:
- Implements a **zero-copy, escape-aware FIX parser** over `&[u8]`:
  - Finds only **unescaped** `|` delimiters.
  - Splits tag/value on the **first `=`** (values may contain `=`).
- Replaces lock-heavy stats with **atomics** and a bounded symbol table:
  - Global counters are `AtomicU64`.
  - Per-symbol counters use a fixed-capacity open-addressing table + fixed-capacity arena (bounded memory).
- Report generation is streaming (`write_report`) and reads atomics without blocking ingestion.

**References (docs):**
- Rust atomics: [std::sync::atomic](https://doc.rust-lang.org/std/sync/atomic/)
- Release/Acquire ordering: [Rust nomicon: Atomics](https://doc.rust-lang.org/nomicon/atomics.html)

---

## 2. Define the Contract (Correctness + Constraints)

The contract is enforced by **release-mode tests** and the **evaluation harness**:
- **Parsing correctness**:
  - Field delimiter is `|`; literal `|` inside values is encoded as `\\|`.
  - Must parse tag **58** containing `\\|` correctly.
  - Must parse order id (tag **11**) containing `\\|` correctly.
  - Malformed messages must be **counted + skipped** without crashing.
  - Timestamps must preserve **microsecond precision**.
- **Concurrency**: report generation must not block ingestion (no global mutex).
- **Performance**:
  - **No heap allocations** in the hot path after warmup (verified by a counting global allocator).
  - **1,000,000 messages in < 3 seconds** in release mode.
- **Evaluation**: `docker-compose` runs:
  - `test-before`: expected to fail (non-compliant baseline)
  - `test-after`: expected to pass
  - `evaluation`: writes JSON reports under `evaluation/reports/`

---

## 3. Design & Implementation

**Parser design (zero-copy + escape-aware):**
- Values are represented as `EscapedValue<'a>` (slice into input buffer).
- `find_unescaped` scans bytes and treats `\\X` as an escaped literal `X`, so `\\|` does not terminate a field.
- Timestamp parsing is integer-based into `FixTimestamp { seconds, micros }` to avoid precision loss.

**Stats design (bounded, lock-free):**
- Global counters use `AtomicU64`.
- Per-symbol stats are stored in a bounded `SymbolTable`:
  - Open addressing with `key_hash` CAS for slot claiming.
  - A monotonic fixed-capacity `Arena` stores decoded symbol bytes once.
  - Slot metadata is published with Release/Acquire to ensure readers see fully-initialized symbols.

**Report design (streaming):**
- `write_report<W: Write>` reads atomics + a snapshot of symbol slots; no message storage, no lock acquisition.

---

## 4. Testing Review

**What is covered:**
- `repository_after/tests/fix_parser_and_analyzer.rs`:
  - Escaped pipe parsing in tag **58**
  - Escaped pipe parsing in tag **11**
  - Malformed message skip + error counting (`process_message_lossy`)
  - Timestamp microsecond precision (`parse_fix_timestamp`)
  - Concurrent report generation during ingestion (should not deadlock/block)
- `repository_after/tests/perf_and_alloc.rs`:
  - Enforces **zero allocations after warmup** via a custom global allocator
  - Enforces **1,000,000 messages < 3 seconds** (release)

**Notable good practices:**
- Performance constraints are enforced by tests (not just described).
- Allocation behavior is measured directly (hard to “fake” with superficial correctness).

---

## 5. Result / Measurable Improvements

- Solution correctly implements all task requirements (escape-aware parsing, lock-free stats, streaming report).
- Tests confirm correctness and performance (functional parsing cases + concurrency + alloc + throughput).
- Good practices maintained: bounded-memory design, clear error modeling (`ParseErrorKind`), and deterministic docker-compose evaluation producing JSON reports.
