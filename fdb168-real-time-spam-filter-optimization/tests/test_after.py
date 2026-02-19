import pytest
import time
import tracemalloc
import numpy as np
from sklearn.metrics import accuracy_score
import sys
import importlib.util

# Import SpamFilterV1 from repository_after
spec = importlib.util.spec_from_file_location("spam_filter_v1", "repository_after/spam_filter_v1.py")
spam_filter_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(spam_filter_module)
SpamFilterV1 = spam_filter_module.SpamFilterV1

@pytest.fixture
def sample_data():
    """Generate synthetic email data: 50% ham, 50% spam, including obfuscated spam."""
    np.random.seed(42)  # For determinism
    ham_templates = [
        "Meeting scheduled for tomorrow at 3pm",
        "Please review the attached document",
        "Thank you for your inquiry",
        "Project update: everything is on track",
        "Invoice attached for your records"
    ]
    spam_templates = [
        "Win free money now",
        "Congratulations you won a prize",
        "Urgent: claim your inheritance",
        "Cheap viagra available",
        "Fr33 m0ney n0w",  # Obfuscated
        "V1agr4 ch34p d34l"  # Obfuscated
    ]
    texts = []
    labels = []
    for i in range(1000):  # 1000 ham
        texts.append(np.random.choice(ham_templates))
        labels.append(0)
    for i in range(1000):  # 1000 spam
        texts.append(np.random.choice(spam_templates))
        labels.append(1)
    return texts, labels

@pytest.fixture
def test_data():
    """Small test data for inference."""
    return generate_synthetic_data(100)

def generate_synthetic_data(num_samples=2000):
    """Helper for test_data."""
    np.random.seed(42)
    ham_templates = [
        "Meeting scheduled for tomorrow at 3pm",
        "Please review the attached document",
        "Thank you for your inquiry",
        "Project update: everything is on track",
        "Invoice attached for your records"
    ]
    spam_templates = [
        "Win free money now",
        "Congratulations you won a prize",
        "Urgent: claim your inheritance",
        "Cheap viagra available",
        "Fr33 m0ney n0w",
        "V1agr4 ch34p d34l"
    ]
    texts = []
    labels = []
    for i in range(num_samples // 2):
        texts.append(np.random.choice(ham_templates))
        labels.append(0)
    for i in range(num_samples // 2):
        texts.append(np.random.choice(spam_templates))
        labels.append(1)
    return texts, labels

def test_error_handling():
    """Test that errors are raised appropriately."""
    filter_obj = SpamFilterV1()
    with pytest.raises(RuntimeError, match="Model not trained"):
        filter_obj.predict("test")
    with pytest.raises(ValueError, match="texts and labels must have same length"):
        filter_obj.train([], [1])

@pytest.mark.parametrize("texts,labels,expected_error", [
    ([], [], ValueError),  # Empty data
    (["hello"], [0, 1], ValueError),  # Mismatched lengths
    (["hello"], ["0"], ValueError),  # Wrong label type
    (["hello"], [2], ValueError),  # Invalid label value
])
def test_train_edge_cases(texts, labels, expected_error):
    """Test edge cases for train method."""
    filter_obj = SpamFilterV1()
    with pytest.raises(expected_error):
        filter_obj.train(texts, labels)

@pytest.mark.parametrize("text", [
    "",  # Empty string
    "   ",  # Whitespace only
    "Fr33 m0ney",  # Obfuscated
    "a" * 10000,  # Very long text
    "123456789",  # Numbers only
    "!@#$%^&*()",  # Special chars
])
def test_predict_edge_cases(text):
    """Test edge cases for predict method."""
    filter_obj = SpamFilterV1()
    filter_obj.train(["ham email", "spam email"], [0, 1])  # Train first
    result = filter_obj.predict(text)
    assert isinstance(result, int)
    assert result in [0, 1]

def test_determinism(sample_data):
    """Test that the model is deterministic."""
    filter_obj = SpamFilterV1()
    texts, labels = sample_data
    test_texts = ["Win free money", "Meeting at 3pm", "Fr33 m0ney"]
    filter_obj.train(texts, labels)
    preds1 = [filter_obj.predict(t) for t in test_texts]
    filter_obj.train(texts, labels)  # Retrain
    preds2 = [filter_obj.predict(t) for t in test_texts]
    assert preds1 == preds2

def test_training_performance(sample_data):
    """Benchmark training time and memory."""
    filter_obj = SpamFilterV1()
    texts, labels = sample_data
    tracemalloc.start()
    start_time = time.time()
    filter_obj.train(texts, labels)
    end_time = time.time()
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    training_time = end_time - start_time
    peak_memory_mb = peak / (1024 * 1024)
    print(f"Training time: {training_time:.2f}s (scaled ~{training_time * 2500:.2f}s for 5M)")
    print(f"Peak memory: {peak_memory_mb:.2f}MB")
    assert training_time < 1.0  # Should be fast for 2k
    assert peak_memory_mb < 10.0  # Reasonable

def test_inference_performance(sample_data, test_data):
    """Benchmark inference latency, throughput, accuracy."""
    filter_obj = SpamFilterV1()
    texts, labels = sample_data
    filter_obj.train(texts, labels)
    test_texts, test_labels = test_data
    latencies = []
    predictions = []
    start_time = time.time()
    for text in test_texts:
        start = time.time()
        pred = filter_obj.predict(text)
        end = time.time()
        latencies.append((end - start) * 1000)  # ms
        predictions.append(pred)
    end_time = time.time()
    total_time = end_time - start_time
    throughput = len(test_texts) / total_time
    p99_latency = np.percentile(latencies, 99)
    acc = accuracy_score(test_labels, predictions)
    print(f"P99 latency: {p99_latency:.2f}ms")
    print(f"Throughput: {throughput:.2f} pred/s")
    print(f"Accuracy: {acc:.2f}")
    assert acc >= 0.75
    assert filter_obj.predict("Fr33 m0ney") == 1
