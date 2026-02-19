"""
Initial spam filter implementation using CountVectorizer + Naive Bayes.

Current Performance Issues:
- Training time: ~45s for 5M emails
- Inference latency: ~150ms per email
- Memory usage: ~2.3GB during training

These metrics violate production SLAs and block deployment.
"""

from typing import List
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB


class SpamFilterV1:
    """
    Baseline spam filter using bag-of-words representation.
    
    Architecture:
    1. CountVectorizer: Converts text to sparse matrix of token counts
    2. MultinomialNB: Probabilistic classifier for categorical features
    
    Known Issues:
    - Stores full vocabulary (100k+ unique tokens)
    - Creates dense n×m matrix in memory during training
    - No streaming support for large datasets
    """
    
    def __init__(self):
        self.vectorizer = CountVectorizer()
        self.model = MultinomialNB()
        
        self.is_trained = False
    
    def train(self, texts: List[str], labels: List[int]) -> None:
        """
        Train the spam filter on provided email texts and labels.
        
        Args:
            texts: List of email content (strings)
            labels: List of binary labels (0=ham, 1=spam)
        
        Raises:
            ValueError: If texts and labels have different lengths
        
        Performance:
            Time: O(n * m) where n=num_emails, m=avg_tokens
            Space: O(n * v) where v=vocabulary_size (typically 100k+)
        """
        if len(texts) != len(labels):
            raise ValueError("texts and labels must have same length")
        X = self.vectorizer.fit_transform(texts)
        
        self.model.fit(X, labels)
        
        self.is_trained = True
    
    def predict(self, text: str) -> int:
        """
        Classify a single email as spam (1) or ham (0).
        
        Args:
            text: Email content to classify
        
        Returns:
            0 (legitimate email) or 1 (spam)
        
        Raises:
            RuntimeError: If called before train()
        
        Performance:
            Time: O(m) where m=num_tokens in text
            Latency: ~150ms (violates <50ms SLA)
        """
        if not self.is_trained:
            raise RuntimeError("Model not trained")
        
        X = self.vectorizer.transform([text])
        return int(self.model.predict(X)[0])