use std::collections::{BinaryHeap, HashMap, HashSet};
use std::cmp::Reverse;

pub struct TextProcessor {
    pub word_counts: HashMap<String, usize>,
    pub stop_words: HashSet<String>,
}

impl TextProcessor {
    pub fn new(stop_words: Vec<String>) -> Self {
        Self {
            word_counts: HashMap::new(),
            stop_words: stop_words.into_iter().map(|s| s.to_lowercase()).collect(),
        }
    }

    pub fn process_text(&mut self, text: &str) {
        for word in text.split_whitespace() {
            let cleaned = self.clean_word(word);
            if cleaned.is_empty() {
                continue;
            }

            // Use lowercase once
            let lower = cleaned.to_lowercase();
            if self.is_stop_word(&lower) {
                continue;
            }

            // Use Entry API
            *self.word_counts.entry(lower).or_insert(0) += 1;
        }
    }

    fn is_stop_word(&self, word: &str) -> bool {
        self.stop_words.contains(word)
    }

    fn clean_word(&self, word: &str) -> String {
        let mut result = String::with_capacity(word.len());
        result.extend(word.chars().filter(|c| c.is_alphanumeric()));
        result
    }

    /// Efficient top-N retrieval using a min-heap to avoid cloning entire HashMap
    pub fn get_top_words(&self, n: usize) -> Vec<(String, usize)> {
        let mut heap: BinaryHeap<Reverse<(usize, &String)>> = BinaryHeap::with_capacity(n);

        for (word, &count) in &self.word_counts {
            if heap.len() < n {
                heap.push(Reverse((count, word)));
            } else if let Some(&Reverse((min_count, _))) = heap.peek() {
                if count > min_count {
                    heap.pop();
                    heap.push(Reverse((count, word)));
                }
            }
        }

        // Extract and sort descending
        let mut top: Vec<(String, usize)> = heap
            .into_iter()
            .map(|Reverse((count, word))| (word.clone(), count))
            .collect();

        top.sort_by(|a, b| b.1.cmp(&a.1));
        top
    }

    pub fn get_unique_words(&self) -> Vec<String> {
        let mut words = Vec::with_capacity(self.word_counts.len());
        for word in self.word_counts.keys() {
            words.push(word.clone());
        }
        words
    }

    pub fn get_word_count(&self, word: &str) -> usize {
        self.word_counts.get(word).copied().unwrap_or(0)
    }

    pub fn total_unique_words(&self) -> usize {
        self.word_counts.len()
    }

    pub fn clear(&mut self) {
        self.word_counts.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_processing() {
        let stop_words = vec!["the".to_string(), "a".to_string(), "is".to_string()];
        let mut processor = TextProcessor::new(stop_words);

        processor.process_text("The quick brown fox is a fox");

        assert_eq!(processor.get_word_count("fox"), 2);
        assert_eq!(processor.get_word_count("quick"), 1);
        assert_eq!(processor.get_word_count("the"), 0);
    }

    #[test]
    fn test_top_words() {
        let stop_words = vec!["the".to_string()];
        let mut processor = TextProcessor::new(stop_words);

        processor.process_text("apple banana apple cherry apple banana");

        let top = processor.get_top_words(2);
        assert_eq!(top[0], ("apple".to_string(), 3));
        assert_eq!(top[1], ("banana".to_string(), 2));
    }

    #[test]
    fn test_punctuation_and_stop_words() {
        let stop_words = vec!["the".to_string(), "is".to_string()];
        let mut processor = TextProcessor::new(stop_words);

        processor.process_text("The. quick brown fox is a fox!");
        assert_eq!(processor.get_word_count("fox"), 2);
        assert_eq!(processor.get_word_count("the"), 0);
        assert_eq!(processor.get_word_count("is"), 0);
        assert_eq!(processor.get_word_count("quick"), 1);
    }

    #[test]
    fn test_get_unique_words_preallocation() {
        let stop_words = vec![];
        let mut processor = TextProcessor::new(stop_words);

        processor.process_text("a b c d e f g");
        let unique = processor.get_unique_words();
        assert!(unique.capacity() >= unique.len());
    }
}
