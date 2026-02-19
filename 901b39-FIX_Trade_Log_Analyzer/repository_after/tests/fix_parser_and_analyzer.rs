use fix_trade_analyzer::{parse_fix_timestamp, FixTimestamp, TradeAnalyzer};
use std::sync::atomic::{AtomicUsize, Ordering};

#[test]
fn parses_escaped_pipe_in_text_58() {
    let analyzer = TradeAnalyzer::new(1024, 1 << 20);
    let raw = b"8=FIX.4.2|35=D|49=SENDER|56=TARGET|11=ORD001|55=AAPL|54=1|38=100|44=150.25|58=hello\\|world|52=20240115-09:30:00.123456|10=128|";
    analyzer.process_message(raw).unwrap();
    assert_eq!(analyzer.total_messages(), 1);
}

#[test]
fn parses_order_id_containing_pipe() {
    let analyzer = TradeAnalyzer::new(1024, 1 << 20);
    let raw = b"8=FIX.4.2|35=D|49=SENDER|56=TARGET|11=ORD\\|001|55=AAPL|54=1|38=100|44=150.25|58=ok|52=20240115-09:30:00.123456|10=128|";
    analyzer.process_message(raw).unwrap();
    assert_eq!(analyzer.total_messages(), 1);
}

#[test]
fn malformed_message_is_logged_and_skipped_without_crash() {
    let analyzer = TradeAnalyzer::new(1024, 1 << 20);
    static ERR: AtomicUsize = AtomicUsize::new(0);

    // Missing '=' in one field (11ORD001) => InvalidField
    let raw = b"8=FIX.4.2|35=D|49=SENDER|56=TARGET|11ORD001|55=AAPL|54=1|38=100|52=20240115-09:30:00.123456|10=128|";
    analyzer.process_message_lossy(raw, |_| {
        ERR.fetch_add(1, Ordering::Relaxed);
    });

    assert_eq!(analyzer.total_messages(), 0);
    assert_eq!(analyzer.malformed_messages(), 1);
    assert_eq!(ERR.load(Ordering::Relaxed), 1);
}

#[test]
fn timestamp_preserves_microsecond_precision() {
    // Unit-level check: micros are preserved exactly (no rounding/truncation).
    let ts = parse_fix_timestamp(b"20240115-09:30:00.123456").unwrap();
    assert_eq!(
        ts,
        FixTimestamp {
            seconds: 20240115 * 1_000_000 + 9 * 10_000 + 30 * 100 + 0,
            micros: 123_456
        }
    );
}

#[test]
fn concurrent_report_generation_does_not_block_ingestion() {
    let analyzer = std::sync::Arc::new(TradeAnalyzer::new(1024, 1 << 20));
    let raw = b"8=FIX.4.2|35=D|49=SENDER|56=TARGET|11=ORD001|55=AAPL|54=1|38=100|44=150.25|58=ok|52=20240115-09:30:00.123456|10=128|";

    let running = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
    let running2 = running.clone();
    let a2 = analyzer.clone();

    let ingest = std::thread::spawn(move || {
        let mut n = 0u64;
        while running2.load(Ordering::Relaxed) && n < 200_000 {
            a2.process_message(raw).unwrap();
            n += 1;
        }
        n
    });

    // Concurrent snapshots/report generation.
    for _ in 0..200 {
        let _ = analyzer.report_string();
        std::hint::spin_loop();
    }

    running.store(false, Ordering::Relaxed);
    let processed = ingest.join().unwrap();
    assert!(processed > 0);
}

