use fix_trade_analyzer::TradeAnalyzer;
use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

struct CountingAlloc;

static ALLOC_CALLS: AtomicU64 = AtomicU64::new(0);
static ALLOC_BYTES: AtomicU64 = AtomicU64::new(0);

unsafe impl GlobalAlloc for CountingAlloc {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOC_CALLS.fetch_add(1, Ordering::Relaxed);
        ALLOC_BYTES.fetch_add(layout.size() as u64, Ordering::Relaxed);
        System.alloc(layout)
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        // We don't track dealloc bytes here; we only enforce "no allocations in hot path".
        System.dealloc(ptr, layout)
    }
}

#[global_allocator]
static A: CountingAlloc = CountingAlloc;

fn reset_alloc_counters() {
    ALLOC_CALLS.store(0, Ordering::Relaxed);
    ALLOC_BYTES.store(0, Ordering::Relaxed);
}

#[test]
fn hot_path_has_no_heap_allocations_after_warmup() {
    let analyzer = TradeAnalyzer::new(16_384, 1 << 20);
    let raw = b"8=FIX.4.2|35=D|49=SENDER|56=TARGET|11=ORD001|55=AAPL|54=1|38=100|44=150.25|58=hello\\|world|52=20240115-09:30:00.123456|10=128|";

    // Warmup: allow symbol insertion to occur.
    analyzer.process_message(raw).unwrap();

    reset_alloc_counters();

    for _ in 0..200_000 {
        analyzer.process_message(raw).unwrap();
    }

    let calls = ALLOC_CALLS.load(Ordering::Relaxed);
    assert_eq!(
        calls, 0,
        "hot path allocated (calls={}, bytes={})",
        calls,
        ALLOC_BYTES.load(Ordering::Relaxed)
    );
}

#[test]
fn processes_one_million_messages_under_three_seconds_release() {
    // This is a strict enforcement of the dataset requirement.
    // It assumes `cargo test --release` (the Dockerfile runs release tests).
    let analyzer = TradeAnalyzer::new(16_384, 1 << 20);
    let raw = b"8=FIX.4.2|35=D|49=SENDER|56=TARGET|11=ORD001|55=AAPL|54=1|38=100|44=150.25|58=hello\\|world|52=20240115-09:30:00.123456|10=128|";

    // Warmup
    for _ in 0..10_000 {
        analyzer.process_message(raw).unwrap();
    }

    let start = Instant::now();
    for _ in 0..1_000_000 {
        analyzer.process_message(raw).unwrap();
    }
    let elapsed = start.elapsed();

    assert!(
        elapsed.as_secs_f64() < 3.0,
        "took {:?} for 1,000,000 messages",
        elapsed
    );
}

