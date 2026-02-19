import json
import subprocess
import sys
from pathlib import Path

import pytest
import tiktoken

# Import your module (ensure pdf_llm_tokenizer.py is on PYTHONPATH)
import pdf_llm_tokenizer as tok


def _make_pdf(path: Path, pages: list[str]) -> None:
    """
    Create a simple multi-page PDF with text.
    Uses reportlab (install: pip install reportlab) for reliable text PDFs.
    """
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter

    c = canvas.Canvas(str(path), pagesize=letter)
    width, height = letter

    for i, txt in enumerate(pages):
        # write multiple lines
        y = height - 72
        for line in txt.split("\n"):
            c.drawString(72, y, line)
            y -= 14
        c.showPage()
    c.save()


@pytest.fixture()
def sample_pdf(tmp_path: Path) -> Path:
    pdf_path = tmp_path / "sample.pdf"
    pages = [
        "Hello   world!\n\nThis is page 1.\nUnicode: አማርኛ ✅\nPunct: ,.;:!?()[]{}",
        "Page 2 has   lots\t\t of   whitespace.\n\n\nAnd multiple blank lines.",
        "",  # empty text page
        "Final page: repeated words " + ("token " * 200),
    ]
    _make_pdf(pdf_path, pages)
    return pdf_path


def test_pdf_to_text_normalization(sample_pdf: Path):
    text = tok.pdf_to_text(str(sample_pdf))
    assert isinstance(text, str)
    # no tabs should remain after normalization of [ \t]+
    assert "\t" not in text
    # no triple-newlines after normalization
    assert "\n\n\n" not in text
    # should not be empty overall given we have text pages
    assert len(text) > 0


def test_encode_decode_roundtrip(sample_pdf: Path):
    text = tok.pdf_to_text(str(sample_pdf))
    ids = tok.encode_text(text, encoding_name="o200k_base")
    assert isinstance(ids, list)
    assert all(isinstance(i, int) for i in ids)

    back = tok.decode_tokens(ids, encoding_name="o200k_base")
    # tiktoken decode(encode(x)) should return the original string
    assert back == text


def test_doc_token_count_matches_direct_tokenization(sample_pdf: Path):
    text = tok.pdf_to_text(str(sample_pdf))
    enc = tiktoken.get_encoding("o200k_base")
    direct_count = len(enc.encode(text))

    data = tok.tokenize_pdf_to_json(str(sample_pdf), max_tokens=120, overlap=20, encoding_name="o200k_base")
    assert data["doc_token_count"] == direct_count


def test_chunk_boundaries_and_overlap(sample_pdf: Path):
    max_tokens = 120
    overlap = 20
    data = tok.tokenize_pdf_to_json(str(sample_pdf), max_tokens=max_tokens, overlap=overlap)

    doc_n = data["doc_token_count"]
    chunks = data["chunks"]
    assert data["chunks_count"] == len(chunks)
    assert len(chunks) >= 2  # should chunk given repeated tokens

    # check schema + monotonicity + internal consistency
    prev = None
    for i, ch in enumerate(chunks):
        assert ch["chunk_index"] == i
        assert 0 <= ch["start_token"] < ch["end_token"] <= doc_n
        assert ch["token_count"] == ch["end_token"] - ch["start_token"]
        assert isinstance(ch["text"], str)

        if prev is not None:
            # expected overlap relationship for non-last chunks
            expected_start = prev["end_token"] - overlap
            assert ch["start_token"] == expected_start
            assert ch["start_token"] < ch["end_token"]
        prev = ch

    # last chunk must end exactly at doc token count
    assert chunks[-1]["end_token"] == doc_n


def test_determinism_same_input_same_output(sample_pdf: Path):
    data1 = tok.tokenize_pdf_to_json(str(sample_pdf), max_tokens=150, overlap=30, encoding_name="o200k_base")
    data2 = tok.tokenize_pdf_to_json(str(sample_pdf), max_tokens=150, overlap=30, encoding_name="o200k_base")

    # Deterministic: counts and boundaries should match
    assert data1["doc_token_count"] == data2["doc_token_count"]
    assert data1["chunks_count"] == data2["chunks_count"]
    assert [c["start_token"] for c in data1["chunks"]] == [c["start_token"] for c in data2["chunks"]]
    assert [c["end_token"] for c in data1["chunks"]] == [c["end_token"] for c in data2["chunks"]]
    assert [c["text"] for c in data1["chunks"]] == [c["text"] for c in data2["chunks"]]


def test_json_serializable(sample_pdf: Path):
    data = tok.tokenize_pdf_to_json(str(sample_pdf), max_tokens=100, overlap=10)
    s = json.dumps(data, ensure_ascii=False)
    data2 = json.loads(s)
    assert data2["doc_token_count"] == data["doc_token_count"]
    assert data2["chunks_count"] == data["chunks_count"]
    assert len(data2["chunks"]) == len(data["chunks"])


@pytest.mark.parametrize(
    "max_tokens,overlap",
    [
        (0, 10),
        (-1, 10),
        (50, -1),
        (50, 50),
        (50, 60),
    ],
)
def test_invalid_chunk_params_raise(max_tokens, overlap):
    ids = list(range(200))
    with pytest.raises(ValueError):
        tok.chunk_token_ids(ids, max_tokens=max_tokens, overlap=overlap)


def test_include_full_text(sample_pdf: Path):
    data = tok.tokenize_pdf_to_json(str(sample_pdf), include_full_text=True)
    assert "full_text" in data
    assert isinstance(data["full_text"], str)
    assert len(data["full_text"]) > 0


def test_cli_end_to_end(tmp_path: Path, sample_pdf: Path):
    out = tmp_path / "out.json"

    # run the script as a CLI program
    # assumes pdf_llm_tokenizer.py is in the current project directory
    cmd = [sys.executable, str(Path(__file__).parent / "pdf_llm_tokenizer.py"),
           str(sample_pdf), "--out", str(out), "--max_tokens", "120", "--overlap", "20"]

    result = subprocess.run(cmd, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert out.exists()

    data = json.loads(out.read_text(encoding="utf-8"))
    assert "doc_token_count" in data
    assert "chunks" in data
    assert data["chunks_count"] == len(data["chunks"])
    # CLI prints should include key lines
    assert "Doc token count:" in result.stdout
    assert "Chunks:" in result.stdout
    assert "Wrote JSON:" in result.stdout
