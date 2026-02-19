import ast
import subprocess
import sys
from pathlib import Path
import pytest
import pdf_llm_tokenizer as tok
import test_pdf_llm_tokenizer as test_suite

def test_meta_suite_completeness():
    """
    Statically inspects the test file to ensure all required behaviors are addressed by at least one test function.
    """
    test_file = Path(__file__).parent / "test_pdf_llm_tokenizer.py"
    tree = ast.parse(test_file.read_text())
    
    test_names = [
        node.name for node in ast.walk(tree) 
        if isinstance(node, ast.FunctionDef) and node.name.startswith("test_")
    ]
    
    requirements = [
        "normalization",
        "roundtrip",
        "token_count",
        "chunk",
        "json",
        "invalid",
        "cli",
        "determinism"
    ]
    
    for req in requirements:
        assert any(req in name.lower() for name in test_names), f"Requirement '{req}' not addressed in test suite"

def test_meta_determinism_rigor(monkeypatch):
    """
    Verifies that the test suite detects non-deterministic behavior.
    """
    # Mutate to return different results on consecutive calls
    original_tokenize = tok.tokenize_pdf_to_json
    # Use a mutable container for state
    state = {'count': 0}
    
    def non_deterministic_tokenize(*args, **kwargs):
        state['count'] += 1
        data = original_tokenize(*args, **kwargs)

        data['doc_token_count'] += state['count']
        return data

    monkeypatch.setattr(tok, "tokenize_pdf_to_json", non_deterministic_tokenize)

    with pytest.raises(AssertionError):
        monkeypatch.setattr(tok, "pdf_to_text", lambda x: "Content")

        monkeypatch.setattr(tok, "encode_text", lambda text, encoding_name: [1, 2, 3])
        monkeypatch.setattr(tok, "chunk_token_ids", lambda ids, **k: [{"chunk_index":0, "start_token":0, "end_token":3}])
        monkeypatch.setattr(tok, "decode_tokens", lambda ids, encoding_name: "Content")
        
        class MockPath: 
            def __str__(self): return "mock.pdf"
        
        test_suite.test_determinism_same_input_same_output(MockPath())

def test_meta_newline_normalization_rigor(monkeypatch, tmp_path):
    """
    Ensures that the test suite verifies newline normalization (handling of empty pages/excess whitespace).
    """
    # Break newline normalization to accept triple newlines
    original_sub = tok.re.sub
    def broken_sub(pattern, repl, string, *args, **kwargs):
        # The code uses r"\n{3,}" to replace with "\n\n"
        if "3," in pattern: 
            return string # Don't normalize newlines
        return original_sub(pattern, repl, string, *args, **kwargs)
        
    monkeypatch.setattr(tok.re, "sub", broken_sub)
    
    with pytest.raises(AssertionError):
        class MockPage:
             def extract_text(self): return "Line1\n\n\nLine2"
        
        class MockReader:
            def __init__(self, path):
                self.pages = [MockPage()]
                
        monkeypatch.setattr(tok, "PdfReader", MockReader)
        
        dummy_path = tmp_path / "dummy_newlines.pdf"
        test_suite.test_pdf_to_text_normalization(dummy_path)

def run_suite_on_module(module_path, test_file):
    """Helper to run pytest on a specific file with a modified environment."""
    result = subprocess.run(
        [sys.executable, "-m", "pytest", str(test_file), "-q", "--no-header"],
        capture_output=True,
        text=True,
        cwd=Path(module_path).parent
    )
    return result

def test_meta_normalization_rigor(monkeypatch, tmp_path):
    """
    Ensures that if whitespace normalization is broken, the test suite detects it.
    """
    # Break normalization: make it NOT remove double spaces or tabs
    original_sub = tok.re.sub
    def broken_sub(pattern, repl, string, *args, **kwargs):
        if pattern == r"[ \t]+":
            return string  # Do nothing
        return original_sub(pattern, repl, string, *args, **kwargs)
    
    monkeypatch.setattr(tok.re, "sub", broken_sub)
    
    # We use a real test run to verify the test suite's effectiveness
    with pytest.raises(AssertionError):
        
        class MockPage:
            def extract_text(self):
                return "Hello\t\tWorld"
        
        class MockReader:
            def __init__(self, path):
                self.pages = [MockPage()]
                
        monkeypatch.setattr(tok, "PdfReader", MockReader)
        
        dummy_path = tmp_path / "dummy.pdf"
        
        try:
            test_suite.test_pdf_to_text_normalization(dummy_path)
        finally:
            pass

def test_meta_token_count_accuracy(monkeypatch):
    """
    Verifies that the test suite detects incorrect doc_token_count.
    """
    # Mutate tokenize_pdf_to_json to return an incorrect count
    original_tokenize = tok.tokenize_pdf_to_json
    def broken_tokenize(*args, **kwargs):
        data = original_tokenize(*args, **kwargs)
        data["doc_token_count"] += 1  # Off by one
        return data
        
    monkeypatch.setattr(tok, "tokenize_pdf_to_json", broken_tokenize)
    
    # Check if the relevant test in the suite would fail
    with pytest.raises(AssertionError):
        monkeypatch.setattr(tok, "pdf_to_text", lambda x: "Hello world")
        
        class MockPath:
            def __str__(self): return "mock.pdf"
            
        test_suite.test_doc_token_count_matches_direct_tokenization(MockPath())

def test_meta_chunking_logic_validation(monkeypatch):
    """
    Verifies that the test suite detects broken chunk overlap boundaries.
    """
    # Mutate chunk_token_ids to break the overlap logic
    original_chunk_ids = tok.chunk_token_ids
    def broken_chunk_ids(token_ids, max_tokens, overlap):
        bounds = original_chunk_ids(token_ids, max_tokens, overlap)
        if len(bounds) > 1:
            bounds[1]["start_token"] += 1 # Shift the start of the second chunk
        return bounds
        
    monkeypatch.setattr(tok, "chunk_token_ids", broken_chunk_ids)
    
    with pytest.raises(AssertionError):
        monkeypatch.setattr(tok, "pdf_to_text", lambda x: " ".join(["word"] * 500))
        class MockPath:
            def __str__(self): return "mock.pdf"
        test_suite.test_chunk_boundaries_and_overlap(MockPath())

def test_meta_error_handling_rigor(monkeypatch):
    """
    Verifies that the test suite detects missing validation.
    """
    # Remove the ValueError check in the implementation
    def weak_chunk_token_ids(token_ids, max_tokens, overlap):
        # No raises here!
        return []
        
    monkeypatch.setattr(tok, "chunk_token_ids", weak_chunk_token_ids)
    
    with pytest.raises(pytest.fail.Exception): # pytest.raises(ValueError) won't happen, so test_suite will fail
        try:
            test_suite.test_invalid_chunk_params_raise(0, 10)
        except Exception as e:
            if isinstance(e, pytest.fail.Exception):
                # This is what happens when pytest.raises(ValueError) doesn't see a ValueError
                raise
            # If it's another error, it orignal test suite failed anyway
            raise

def test_meta_cli_verification(monkeypatch):
    """
    Verifies that the CLI test actually checks the output format/content.
    """
    # Mock subprocess.run to return successful but WRONG output
    import subprocess
    original_run = subprocess.run
    
    def mock_run(cmd, **kwargs):
        class MockResult:
            returncode = 0
            stdout = "Success!" # Missing "Doc token count:", "Chunks:", etc.
            stderr = ""
        return MockResult()
        
    monkeypatch.setattr(subprocess, "run", mock_run)
    
    with pytest.raises(AssertionError):
        # We need a dummy path
        test_suite.test_cli_end_to_end(Path("."), Path("sample.pdf"))

if __name__ == "__main__":
    pytest.main([__file__])

def test_meta_roundtrip_rigor(monkeypatch):
    """
    Verifies that the roundtrip test actually checks equality.
    """
    # Mutate decode_tokens to return garbage
    monkeypatch.setattr(tok, "decode_tokens", lambda tokens, encoding_name: "GARBAGE")
    
    with pytest.raises(AssertionError):
        # We need to mock pdf_to_text to return something valid
        monkeypatch.setattr(tok, "pdf_to_text", lambda x: "Hello World")
        class MockPath:
            def __str__(self): return "mock.pdf"
            
        test_suite.test_encode_decode_roundtrip(MockPath())

def test_meta_json_serialization_rigor(monkeypatch, tmp_path):
    """
    Verifies that the JSON test actually attempts serialization.
    """
    # Mutate tokenize_pdf_to_json to return a non-serializable object (a set)
    original_tokenize = tok.tokenize_pdf_to_json
    def broken_tokenize(*args, **kwargs):
        data = original_tokenize(*args, **kwargs)
        data["chunks"] = {1, 2, 3} # Sets are not JSON serializable
        return data
        
    monkeypatch.setattr(tok, "tokenize_pdf_to_json", broken_tokenize)
    
    # The test function should fail with TypeError when calling json.dumps
    with pytest.raises(TypeError):
        # Mock pdf_to_text to avoid file needs
        monkeypatch.setattr(tok, "pdf_to_text", lambda x: "Hello")
        # Need a dummy path
        dummy_path = tmp_path / "dummy.pdf"
        test_suite.test_json_serializable(dummy_path)
