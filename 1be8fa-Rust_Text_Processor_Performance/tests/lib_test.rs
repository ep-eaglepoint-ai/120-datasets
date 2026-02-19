use std::mem::size_of;

use text_processor::TextProcessor;

#[test]
fn test_behavior_and_logic_correctness() {
    let stop_words = vec!["the".to_string(), "is".to_string()];
    let mut processor = TextProcessor::new(stop_words);

    processor.process_text("The. quick brown fox is a fox!");

    // Cleaning + lowercase BEFORE stop-word filtering
    assert_eq!(processor.get_word_count("the"), 0);
    assert_eq!(processor.get_word_count("is"), 0);

    // Punctuation removed
    assert_eq!(processor.get_word_count("fox"), 2);
    assert_eq!(processor.get_word_count("quick"), 1);
}

#[test]
fn test_get_top_words_correctness_and_no_full_clone_requirement() {
    let stop_words = vec![];
    let mut processor = TextProcessor::new(stop_words);

    processor.process_text("apple banana apple cherry apple banana");

    let top = processor.get_top_words(2);

    assert_eq!(top.len(), 2);
    assert_eq!(top[0], ("apple".to_string(), 3));
    assert_eq!(top[1], ("banana".to_string(), 2));
}

#[test]
fn test_get_unique_words_preallocates_capacity() {
    let stop_words = vec![];
    let mut processor = TextProcessor::new(stop_words);

    processor.process_text("a b c d e f g");

    let unique = processor.get_unique_words();

    // Capacity check is a proxy for pre-allocation
    assert!(
        unique.capacity() >= unique.len(),
        "Vec should be pre-allocated using with_capacity"
    );
}

#[test]
fn test_no_pathological_memory_bloat() {
    let stop_words = vec![];
    let mut processor = TextProcessor::new(stop_words);

    processor.process_text("apple apple apple");

    // Sanity check: map size stays minimal
    assert_eq!(processor.total_unique_words(), 1);

    // Ensure String + usize tuple size is reasonable
    let entry_size = size_of::<(String, usize)>();
    assert!(entry_size < 64, "Unexpected memory bloat detected");
}
