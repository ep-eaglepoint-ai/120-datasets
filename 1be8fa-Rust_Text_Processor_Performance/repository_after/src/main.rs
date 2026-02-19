use text_processor::TextProcessor;

fn main() {
    let stop_words = vec!["the".to_string(), "a".to_string(), "is".to_string()];
    let mut processor = TextProcessor::new(stop_words);
    
    processor.process_text("The quick brown fox is a fox");
    
    println!("Word count for 'fox': {}", processor.get_word_count("fox"));
    println!("Total unique words: {}", processor.total_unique_words());
    println!("Text processor initialized successfully");
}

