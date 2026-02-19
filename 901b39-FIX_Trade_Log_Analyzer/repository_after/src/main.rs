use fix_trade_analyzer::TradeAnalyzer;

fn main() {
    // Minimal smoke runner. For real throughput testing use `cargo test --release`.
    let analyzer = TradeAnalyzer::new(16_384, 1 << 20);
    let sample = b"8=FIX.4.2|35=D|49=SENDER|56=TARGET|11=ORD001|55=AAPL|54=1|38=100|44=150.25|52=20240115-09:30:00.123456|10=128|";

    analyzer.process_message_lossy(sample, |e| eprintln!("malformed: {e}"));
    print!("{}", analyzer.report_string());
}

