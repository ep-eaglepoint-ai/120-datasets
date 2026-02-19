use std::fmt;
use std::io;
use std::io::Write;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};

/// FIX messages here use `|` as the delimiter (instead of SOH).
/// Values may contain a literal `|` escaped as `\|` (backslash escape).
///
/// This crate's hot path avoids heap allocation after warmup:
/// - Message parsing is zero-copy (`&[u8]` slices into the input buffer)
/// - Stats are updated via atomics
/// - New symbol insertion copies bytes into a fixed-capacity arena (warmup-only)
pub const FIELD_DELIM: u8 = b'|';
pub const ESCAPE: u8 = b'\\';

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FixTimestamp {
    /// YYYYMMDD-HH:MM:SS
    pub seconds: u64,
    /// 0..=999_999
    pub micros: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParseErrorKind {
    MissingTag,
    InvalidTag,
    InvalidField,
    InvalidNumber,
    InvalidTimestamp,
    ArenaFull,
    TableFull,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ParseError {
    pub kind: ParseErrorKind,
    pub at_byte: usize,
}

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?} at byte {}", self.kind, self.at_byte)
    }
}

impl std::error::Error for ParseError {}

/// A view of a field value that may contain backslash escapes (notably `\|`).
#[derive(Debug, Clone, Copy)]
pub struct EscapedValue<'a> {
    raw: &'a [u8],
}

impl<'a> EscapedValue<'a> {
    pub fn new(raw: &'a [u8]) -> Self {
        Self { raw }
    }

    pub fn raw(&self) -> &'a [u8] {
        self.raw
    }

    pub fn decoded_len(&self) -> usize {
        decoded_len(self.raw)
    }

    /// Decode into `out`, returning the number of bytes written.
    /// Caller must ensure `out.len() >= decoded_len()`.
    pub fn decode_into(&self, out: &mut [u8]) -> usize {
        decode_into(self.raw, out)
    }

    pub fn to_string_lossy(&self) -> String {
        // Not hot path: only used by tests/reporting.
        let mut buf = vec![0u8; self.decoded_len()];
        let n = self.decode_into(&mut buf);
        String::from_utf8_lossy(&buf[..n]).to_string()
    }
}

#[derive(Debug, Clone, Copy)]
struct Parsed<'a> {
    order_id: EscapedValue<'a>,
    symbol: EscapedValue<'a>,
    side: u8,
    quantity: u64,
    timestamp: FixTimestamp,
    text58: Option<EscapedValue<'a>>,
}

/// Lock-free, bounded-memory analyzer.
///
/// - **No message buffering**: we do not store messages; only statistics.
/// - **No mutexes**: ingestion updates atomics only.
/// - **Bounded memory**: symbol storage is a fixed-capacity arena and table.
pub struct TradeAnalyzer {
    total_messages: AtomicU64,
    malformed_messages: AtomicU64,
    side_buy: AtomicU64,
    side_sell: AtomicU64,
    symbols: SymbolTable,
}

impl TradeAnalyzer {
    /// `max_symbols` bounds the number of distinct symbols that can be tracked.
    /// `arena_bytes` bounds the total bytes available to store unique symbol strings.
    pub fn new(max_symbols: usize, arena_bytes: usize) -> Self {
        Self {
            total_messages: AtomicU64::new(0),
            malformed_messages: AtomicU64::new(0),
            side_buy: AtomicU64::new(0),
            side_sell: AtomicU64::new(0),
            symbols: SymbolTable::new(max_symbols, arena_bytes),
        }
    }

    /// Parse and ingest one FIX message.
    ///
    /// Malformed messages are counted, optionally logged by the caller, and skipped.
    /// This function does **not** allocate on the hot path after warmup.
    pub fn process_message(&self, raw: &[u8]) -> Result<(), ParseError> {
        let parsed = parse_required(raw)?;

        self.total_messages.fetch_add(1, Ordering::Relaxed);
        match parsed.side {
            b'1' => {
                self.side_buy.fetch_add(1, Ordering::Relaxed);
            }
            b'2' => {
                self.side_sell.fetch_add(1, Ordering::Relaxed);
            }
            _ => {}
        }

        // Per-symbol counters (count + volume)
        self.symbols
            .record(&parsed.symbol, parsed.quantity)
            .map_err(|kind| ParseError { kind, at_byte: 0 })?;

        // text58 is parsed to validate escaped delimiter handling; we don't persist it.
        let _ = parsed.text58;
        let _ = parsed.order_id;
        let _ = parsed.timestamp;

        Ok(())
    }

    /// Like `process_message`, but never returns an error: it logs the error via `log_fn`.
    pub fn process_message_lossy<F: FnMut(ParseError)>(&self, raw: &[u8], mut log_fn: F) {
        if let Err(e) = self.process_message(raw) {
            self.malformed_messages.fetch_add(1, Ordering::Relaxed);
            log_fn(e);
        }
    }

    pub fn total_messages(&self) -> u64 {
        self.total_messages.load(Ordering::Relaxed)
    }

    pub fn malformed_messages(&self) -> u64 {
        self.malformed_messages.load(Ordering::Relaxed)
    }

    /// Streaming, non-blocking report generation: reads atomics and writes to `out`.
    pub fn write_report<W: Write>(&self, out: &mut W) -> io::Result<()> {
        writeln!(out, "=== Compliance Report ===")?;
        writeln!(out, "total_messages: {}", self.total_messages())?;
        writeln!(out, "malformed_messages: {}", self.malformed_messages())?;
        writeln!(out, "side_buy: {}", self.side_buy.load(Ordering::Relaxed))?;
        writeln!(out, "side_sell: {}", self.side_sell.load(Ordering::Relaxed))?;

        writeln!(out, "\n=== Volume by Symbol ===")?;
        for s in self.symbols.snapshot() {
            writeln!(out, "{} count={} volume={}", s.symbol, s.count, s.volume)?;
        }
        Ok(())
    }

    /// Convenience helper for tests/tools.
    pub fn report_string(&self) -> String {
        let mut buf = Vec::new();
        let _ = self.write_report(&mut buf);
        String::from_utf8_lossy(&buf).to_string()
    }
}

/// Public, precision-preserving timestamp parser for validation and tooling.
pub fn parse_fix_timestamp(s: &[u8]) -> Result<FixTimestamp, ParseError> {
    parse_timestamp(s).map_err(|_| ParseError {
        kind: ParseErrorKind::InvalidTimestamp,
        at_byte: 0,
    })
}

fn parse_required(raw: &[u8]) -> Result<Parsed<'_>, ParseError> {
    let mut order_id: Option<EscapedValue<'_>> = None;
    let mut symbol: Option<EscapedValue<'_>> = None;
    let mut side: Option<u8> = None;
    let mut quantity: Option<u64> = None;
    let mut timestamp: Option<FixTimestamp> = None;
    let mut text58: Option<EscapedValue<'_>> = None;

    let mut i = 0usize;
    while i < raw.len() {
        let field_start = i;
        let field_end = find_unescaped(raw, i, FIELD_DELIM);
        i = match field_end {
            Some(j) => j + 1,
            None => raw.len(),
        };

        if field_start == i - 1 {
            // empty field (e.g. trailing delimiter)
            continue;
        }

        let field = &raw[field_start..field_end.unwrap_or(raw.len())];
        let (tag, value) = split_tag_value(field).ok_or(ParseError {
            kind: ParseErrorKind::InvalidField,
            at_byte: field_start,
        })?;

        match tag {
            b"11" => order_id = Some(EscapedValue::new(value)),
            b"55" => symbol = Some(EscapedValue::new(value)),
            b"54" => side = value.first().copied(),
            b"38" => {
                quantity = Some(parse_u64(value).map_err(|_| ParseError {
                    kind: ParseErrorKind::InvalidNumber,
                    at_byte: field_start,
                })?)
            }
            b"52" => {
                timestamp = Some(parse_timestamp(value).map_err(|_| ParseError {
                    kind: ParseErrorKind::InvalidTimestamp,
                    at_byte: field_start,
                })?)
            }
            b"58" => text58 = Some(EscapedValue::new(value)),
            _ => {}
        }
    }

    Ok(Parsed {
        order_id: order_id.ok_or(ParseError {
            kind: ParseErrorKind::MissingTag,
            at_byte: 0,
        })?,
        symbol: symbol.ok_or(ParseError {
            kind: ParseErrorKind::MissingTag,
            at_byte: 0,
        })?,
        side: side.ok_or(ParseError {
            kind: ParseErrorKind::MissingTag,
            at_byte: 0,
        })?,
        quantity: quantity.ok_or(ParseError {
            kind: ParseErrorKind::MissingTag,
            at_byte: 0,
        })?,
        timestamp: timestamp.ok_or(ParseError {
            kind: ParseErrorKind::MissingTag,
            at_byte: 0,
        })?,
        text58,
    })
}

fn split_tag_value(field: &[u8]) -> Option<(&[u8], &[u8])> {
    // Split on the first '='. Values may contain '='; we preserve them.
    let mut idx = None;
    for (i, &b) in field.iter().enumerate() {
        if b == b'=' {
            idx = Some(i);
            break;
        }
    }
    let i = idx?;
    let tag = &field[..i];
    let value = &field[i + 1..];
    if tag.is_empty() {
        return None;
    }
    Some((tag, value))
}

fn find_unescaped(buf: &[u8], mut i: usize, needle: u8) -> Option<usize> {
    while i < buf.len() {
        let b = buf[i];
        if b == ESCAPE {
            if i + 1 < buf.len() {
                i += 2;
            } else {
                // trailing escape; treat as literal
                i += 1;
            }
            continue;
        }
        if b == needle {
            return Some(i);
        }
        i += 1;
    }
    None
}

fn decoded_len(raw: &[u8]) -> usize {
    let mut n = 0usize;
    let mut i = 0usize;
    while i < raw.len() {
        if raw[i] == ESCAPE && i + 1 < raw.len() {
            n += 1;
            i += 2;
        } else {
            n += 1;
            i += 1;
        }
    }
    n
}

fn decode_into(raw: &[u8], out: &mut [u8]) -> usize {
    let mut w = 0usize;
    let mut i = 0usize;
    while i < raw.len() {
        if raw[i] == ESCAPE && i + 1 < raw.len() {
            out[w] = raw[i + 1];
            w += 1;
            i += 2;
        } else {
            out[w] = raw[i];
            w += 1;
            i += 1;
        }
    }
    w
}

fn parse_u64(mut s: &[u8]) -> Result<u64, ()> {
    if s.is_empty() {
        return Err(());
    }
    // No escapes expected for numeric fields; if present, treat as invalid.
    if s.iter().any(|&b| b == ESCAPE) {
        return Err(());
    }
    let mut v: u64 = 0;
    while !s.is_empty() {
        let d = s[0];
        if !(b'0'..=b'9').contains(&d) {
            return Err(());
        }
        v = v
            .checked_mul(10)
            .and_then(|x| x.checked_add((d - b'0') as u64))
            .ok_or(())?;
        s = &s[1..];
    }
    Ok(v)
}

fn parse_timestamp(s: &[u8]) -> Result<FixTimestamp, ()> {
    // Format: YYYYMMDD-HH:MM:SS.ssssss
    // Preserve full microsecond precision by storing micros as u32.
    if s.len() < 24 {
        return Err(());
    }
    if s[8] != b'-' || s[11] != b':' || s[14] != b':' || s[17] != b'.' {
        return Err(());
    }
    if s.iter().any(|&b| b == ESCAPE) {
        return Err(());
    }

    let ymd = parse_u64(&s[0..8]).map_err(|_| ())?;
    let hh = parse_u64(&s[9..11]).map_err(|_| ())?;
    let mm = parse_u64(&s[12..14]).map_err(|_| ())?;
    let ss = parse_u64(&s[15..17]).map_err(|_| ())?;
    let micros = parse_u64(&s[18..24]).map_err(|_| ())? as u32;
    if micros > 999_999 {
        return Err(());
    }

    // We do not interpret timezone; we preserve a deterministic numeric representation:
    // seconds = YYYYMMDDHHMMSS (base-10 packed) for stable ordering and lossless round-trip
    // in this dataset context.
    let seconds = ymd * 1_000_000 + hh * 10_000 + mm * 100 + ss;
    Ok(FixTimestamp { seconds, micros })
}

#[derive(Debug, Clone)]
pub struct SymbolSnapshot {
    pub symbol: String,
    pub count: u64,
    pub volume: u64,
}

struct SymbolTable {
    mask: usize,
    slots: Box<[SymbolSlot]>,
    arena: Arena,
}

struct SymbolSlot {
    key_hash: AtomicU64, // 0 => empty
    meta: AtomicU64,     // 0 => uninitialized
    count: AtomicU64,
    volume: AtomicU64,
}

impl SymbolSlot {
    fn new() -> Self {
        Self {
            key_hash: AtomicU64::new(0),
            meta: AtomicU64::new(0),
            count: AtomicU64::new(0),
            volume: AtomicU64::new(0),
        }
    }
}

impl SymbolTable {
    fn new(max_symbols: usize, arena_bytes: usize) -> Self {
        let cap = max_symbols.next_power_of_two().max(8);
        let mut v = Vec::with_capacity(cap);
        for _ in 0..cap {
            v.push(SymbolSlot::new());
        }
        Self {
            mask: cap - 1,
            slots: v.into_boxed_slice(),
            arena: Arena::new(arena_bytes),
        }
    }

    fn record(&self, symbol: &EscapedValue<'_>, qty: u64) -> Result<(), ParseErrorKind> {
        let (hash, decoded_len) = hash64_and_len(symbol.raw());
        let mut idx = (hash as usize) & self.mask;

        for _probe in 0..=self.mask {
            let slot = &self.slots[idx];
            let existing = slot.key_hash.load(Ordering::Acquire);
            if existing == hash {
                // Potential match. Ensure meta published, then compare bytes (collision check).
                let meta = wait_meta(&slot.meta);
                let (off, len) = unpack_meta(meta);
                let stored = self.arena.get(off, len).ok_or(ParseErrorKind::ArenaFull)?;
                if escaped_eq(symbol.raw(), stored) {
                    slot.count.fetch_add(1, Ordering::Relaxed);
                    slot.volume.fetch_add(qty, Ordering::Relaxed);
                    return Ok(());
                }
                // Extremely unlikely: hash collision. Continue probing for an empty slot.
            } else if existing == 0 {
                // Try to claim this slot.
                if slot
                    .key_hash
                    .compare_exchange(0, hash, Ordering::AcqRel, Ordering::Acquire)
                    .is_ok()
                {
                    let off = self.arena.alloc(decoded_len).ok_or(ParseErrorKind::ArenaFull)?;
                    let out = self
                        .arena
                        .get_mut(off, decoded_len)
                        .ok_or(ParseErrorKind::ArenaFull)?;
                    let wrote = decode_into(symbol.raw(), out);
                    debug_assert_eq!(wrote, decoded_len);
                    slot.meta.store(pack_meta(off, decoded_len), Ordering::Release);
                    slot.count.store(1, Ordering::Relaxed);
                    slot.volume.store(qty, Ordering::Relaxed);
                    return Ok(());
                }
            }
            idx = (idx + 1) & self.mask;
        }
        Err(ParseErrorKind::TableFull)
    }

    fn snapshot(&self) -> Vec<SymbolSnapshot> {
        let mut out = Vec::new();
        for slot in self.slots.iter() {
            let h = slot.key_hash.load(Ordering::Acquire);
            if h == 0 {
                continue;
            }
            let meta = slot.meta.load(Ordering::Acquire);
            if meta == 0 {
                // insertion in-flight; skip for this snapshot
                continue;
            }
            let (off, len) = unpack_meta(meta);
            let stored = match self.arena.get(off, len) {
                Some(s) => s,
                None => continue,
            };
            let symbol = String::from_utf8_lossy(stored).to_string();
            let count = slot.count.load(Ordering::Relaxed);
            let volume = slot.volume.load(Ordering::Relaxed);
            out.push(SymbolSnapshot {
                symbol,
                count,
                volume,
            });
        }
        out
    }
}

fn wait_meta(a: &AtomicU64) -> u64 {
    // Insertion publishes meta with Release after key_hash CAS. Readers use Acquire.
    // We allow a short spin for the meta to become visible.
    let mut v = a.load(Ordering::Acquire);
    let mut spins = 0u32;
    while v == 0 && spins < 1000 {
        std::hint::spin_loop();
        v = a.load(Ordering::Acquire);
        spins += 1;
    }
    v
}

fn pack_meta(off: usize, len: usize) -> u64 {
    ((off as u64) << 32) | ((len as u64) & 0xFFFF_FFFF)
}

fn unpack_meta(meta: u64) -> (usize, usize) {
    let off = (meta >> 32) as usize;
    let len = (meta & 0xFFFF_FFFF) as usize;
    (off, len)
}

struct Arena {
    buf: Box<[u8]>,
    next: AtomicUsize,
}

impl Arena {
    fn new(cap: usize) -> Self {
        Self {
            buf: vec![0u8; cap].into_boxed_slice(),
            next: AtomicUsize::new(0),
        }
    }

    fn alloc(&self, len: usize) -> Option<usize> {
        if len == 0 {
            return None;
        }
        loop {
            let cur = self.next.load(Ordering::Relaxed);
            let end = cur.checked_add(len)?;
            if end > self.buf.len() {
                return None;
            }
            if self
                .next
                .compare_exchange(cur, end, Ordering::AcqRel, Ordering::Relaxed)
                .is_ok()
            {
                return Some(cur);
            }
        }
    }

    fn get(&self, off: usize, len: usize) -> Option<&[u8]> {
        let end = off.checked_add(len)?;
        if end > self.buf.len() {
            return None;
        }
        Some(&self.buf[off..end])
    }

    fn get_mut(&self, off: usize, len: usize) -> Option<&mut [u8]> {
        let end = off.checked_add(len)?;
        if end > self.buf.len() {
            return None;
        }
        // Safe because:
        // - each allocated region is unique (monotonic allocator)
        // - regions are only written once during insertion
        let ptr = self.buf.as_ptr() as *mut u8;
        unsafe { Some(std::slice::from_raw_parts_mut(ptr.add(off), len)) }
    }
}

fn hash64_and_len(raw: &[u8]) -> (u64, usize) {
    // FNV-1a 64-bit over decoded bytes. Deterministic, allocation-free.
    let mut h: u64 = 0xcbf29ce484222325;
    let mut i = 0usize;
    let mut n = 0usize;
    while i < raw.len() {
        let b = if raw[i] == ESCAPE && i + 1 < raw.len() {
            let v = raw[i + 1];
            i += 2;
            v
        } else {
            let v = raw[i];
            i += 1;
            v
        };
        n += 1;
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    if h == 0 {
        (1, n)
    } else {
        (h, n)
    }
}

fn escaped_eq(raw: &[u8], stored: &[u8]) -> bool {
    let mut i = 0usize;
    let mut j = 0usize;
    while i < raw.len() {
        let b = if raw[i] == ESCAPE && i + 1 < raw.len() {
            let v = raw[i + 1];
            i += 2;
            v
        } else {
            let v = raw[i];
            i += 1;
            v
        };
        if j >= stored.len() || stored[j] != b {
            return false;
        }
        j += 1;
    }
    j == stored.len()
}

