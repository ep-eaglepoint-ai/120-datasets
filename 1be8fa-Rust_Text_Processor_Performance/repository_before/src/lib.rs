use std::collections::HashMap;

pub struct TextProcessor {
    word_counts: HashMap<String, usize>,
    stop_words: Vec<String>,
}

impl TextProcessor {
    pub fn new(stop_words: Vec<String>) -> Self {
        TextProcessor {
            word_counts: HashMap::new(),
            stop_words,
        }
    }

    pub fn process_text(&mut self, text: &str) {
        let words: Vec<String> = text
            .split_whitespace()
            .map(|w| w.to_lowercase())
            .collect();

        for word in words {
            if !self.is_stop_word(&word.clone()) {
                let cleaned = self.clean_word(word.clone());
                if !cleaned.is_empty() {
                    if self.word_counts.contains_key(&cleaned) {
                        *self.word_counts.get_mut(&cleaned).unwrap() += 1;
                    } else {
                        self.word_counts.insert(cleaned, 1);
                    }
                }
            }
        }
    }

    fn is_stop_word(&self, word: &str) -> bool {
        for stop_word in &self.stop_words {
            if stop_word == word {
                return true;
            }
        }
        false
    }

    fn clean_word(&self, word: String) -> String {
        let mut result = String::new();
        for c in word.chars() {
            if c.is_alphanumeric() {
                result.push(c);
            }
        }
        result
    }

    pub fn get_top_words(&self, n: usize) -> Vec<(String, usize)> {
        let mut counts: Vec<(String, usize)> = self
            .word_counts
            .clone()
            .into_iter()
            .collect();
        
        counts.sort_by(|a, b| b.1.cmp(&a.1));
        counts.truncate(n);
        counts
    }

    pub fn get_unique_words(&self) -> Vec<String> {
        let mut words = Vec::new();
        for (word, _) in &self.word_counts {
            words.push(word.clone());
        }
        words
    }

    pub fn get_word_count(&self, word: &str) -> usize {
        match self.word_counts.get(word) {
            Some(count) => *count,
            None => 0,
        }
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
        assert_eq!(top[0].0, "apple");
        assert_eq!(top[0].1, 3);
    }
}