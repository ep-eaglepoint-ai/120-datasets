use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone)]
pub struct FixMessage {
    pub msg_type: String,
    pub sender: String,
    pub target: String,
    pub order_id: String,
    pub symbol: String,
    pub side: String,
    pub quantity: u64,
    pub price: f64,
    pub timestamp: String,
}

pub struct TradeAnalyzer {
    messages: Mutex<Vec<FixMessage>>,
    stats: Mutex<HashMap<String, i64>>,
    seen_order_ids: Mutex<Vec<String>>,
}

impl TradeAnalyzer {
    pub fn new() -> Self {
        TradeAnalyzer {
            messages: Mutex::new(Vec::new()),
            stats: Mutex::new(HashMap::new()),
            seen_order_ids: Mutex::new(Vec::new()),
        }
    }

    pub fn process_message(&self, raw: String) -> Result<(), String> {
        let fields: Vec<String> = raw.split('|')
            .map(|s| s.to_string())
            .collect();

        let mut msg = FixMessage {
            msg_type: String::new(),
            sender: String::new(),
            target: String::new(),
            order_id: String::new(),
            symbol: String::new(),
            side: String::new(),
            quantity: 0,
            price: 0.0,
            timestamp: String::new(),
        };

        for field in fields {
            let parts: Vec<&str> = field.split('=').collect();
            if parts.len() != 2 {
                continue;
            }

            let tag = parts[0];
            let value = parts[1].to_string();

            match tag {
                "35" => msg.msg_type = value,
                "49" => msg.sender = value,
                "56" => msg.target = value,
                "11" => msg.order_id = value,
                "55" => msg.symbol = value,
                "54" => msg.side = value,
                "38" => msg.quantity = value.parse().unwrap_or(0),
                "44" => msg.price = value.parse().unwrap_or(0.0),
                "52" => msg.timestamp = value,
                _ => {}
            }
        }

        if msg.order_id.is_empty() {
            return Err("Missing order ID".to_string());
        }

        let mut seen = self.seen_order_ids.lock().unwrap();
        for existing in seen.iter() {
            if existing == &msg.order_id {
                return Err(format!("Duplicate order ID: {}", msg.order_id));
            }
        }
        seen.push(msg.order_id.clone());
        drop(seen);

        self.update_stats(&msg);

        let mut messages = self.messages.lock().unwrap();
        messages.push(msg);

        Ok(())
    }

    fn update_stats(&self, msg: &FixMessage) {
        let mut stats = self.stats.lock().unwrap();

        let symbol_key = format!("symbol_{}", msg.symbol);
        let count = *stats.get(&symbol_key).unwrap_or(&0);
        stats.insert(symbol_key, count + 1);

        let side_key = format!("side_{}", msg.side);
        let count = *stats.get(&side_key).unwrap_or(&0);
        stats.insert(side_key, count + 1);

        let total_key = "total_messages".to_string();
        let count = *stats.get(&total_key).unwrap_or(&0);
        stats.insert(total_key, count + 1);

        let volume_key = format!("volume_{}", msg.symbol);
        let vol = *stats.get(&volume_key).unwrap_or(&0);
        stats.insert(volume_key, vol + msg.quantity as i64);
    }

    pub fn get_stats(&self) -> HashMap<String, i64> {
        let stats = self.stats.lock().unwrap();
        stats.clone()
    }

    pub fn generate_report(&self) -> String {
        let messages = self.messages.lock().unwrap();
        let stats = self.stats.lock().unwrap();

        let mut report = String::new();
        report.push_str("=== Trade Report ===\n");
        report.push_str(&format!("Total Messages: {}\n", messages.len()));

        for (key, value) in stats.iter() {
            report.push_str(&format!("{}: {}\n", key, value));
        }

        let mut symbol_volumes: HashMap<String, u64> = HashMap::new();
        for msg in messages.iter() {
            *symbol_volumes.entry(msg.symbol.clone()).or_insert(0) += msg.quantity;
        }

        report.push_str("\n=== Volume by Symbol ===\n");
        for (symbol, volume) in symbol_volumes.iter() {
            report.push_str(&format!("{}: {}\n", symbol, volume));
        }

        report
    }

    pub fn get_message_count(&self) -> usize {
        let messages = self.messages.lock().unwrap();
        messages.len()
    }

    pub fn clear_old_messages(&self, keep_last: usize) {
        let mut messages = self.messages.lock().unwrap();
        if messages.len() > keep_last {
            let drain_count = messages.len() - keep_last;
            messages.drain(0..drain_count);
        }
    }
}
