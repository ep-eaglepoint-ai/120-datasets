# pdf_llm_tokenizer.py
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, asdict
from typing import List, Dict, Any

from pypdf import PdfReader
import tiktoken


# ---------- Core: PDF -> text ----------
def pdf_to_text(pdf_path: str) -> str:
    reader = PdfReader(pdf_path)
    pages = []
    for p in reader.pages:
        pages.append(p.extract_text() or "")
    text = "\n".join(pages)
    # normalize whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ---------- Core: LLM tokens + chunking ----------
@dataclass
class Chunk:
    chunk_index: int
    start_token: int
    end_token: int
    token_count: int
    text: str


def encode_text(text: str, encoding_name: str = "o200k_base") -> List[int]:
    enc = tiktoken.get_encoding(encoding_name)
    return enc.encode(text)


def decode_tokens(token_ids: List[int], encoding_name: str = "o200k_base") -> str:
    enc = tiktoken.get_encoding(encoding_name)
    return enc.decode(token_ids)


def chunk_token_ids(
    token_ids: List[int],
    max_tokens: int = 800,
    overlap: int = 80,
) -> List[Dict[str, int]]:
    """
    Returns chunk boundaries in token-id space.
    overlap is applied between chunks; does NOT affect doc token count.
    """
    if max_tokens <= 0:
        raise ValueError("max_tokens must be > 0")
    if overlap < 0:
        raise ValueError("overlap must be >= 0")
    if overlap >= max_tokens:
        raise ValueError("overlap must be < max_tokens")

    n = len(token_ids)
    bounds: List[Dict[str, int]] = []
    start = 0
    idx = 0
    while start < n:
        end = min(start + max_tokens, n)
        bounds.append({"chunk_index": idx, "start_token": start, "end_token": end})
        if end == n:
            break
        start = max(0, end - overlap)
        idx += 1
    return bounds


def tokenize_pdf_to_json(
    pdf_path: str,
    max_tokens: int = 800,
    overlap: int = 80,
    encoding_name: str = "o200k_base",
    include_full_text: bool = False,
) -> Dict[str, Any]:
    """
    Produces a JSON-serializable dict:
      - doc_token_count: true token count of the full PDF text (no overlap inflation)
      - chunks: list of chunk objects with text + token counts
    """
    text = pdf_to_text(pdf_path)
    token_ids = encode_text(text, encoding_name=encoding_name)

    doc_token_count = len(token_ids)  # TRUE doc token count
    boundaries = chunk_token_ids(token_ids, max_tokens=max_tokens, overlap=overlap)

    chunks: List[Chunk] = []
    for b in boundaries:
        s, e = b["start_token"], b["end_token"]
        chunk_ids = token_ids[s:e]
        chunk_text = decode_tokens(chunk_ids, encoding_name=encoding_name)
        chunks.append(
            Chunk(
                chunk_index=b["chunk_index"],
                start_token=s,
                end_token=e,
                token_count=len(chunk_ids),
                text=chunk_text,
            )
        )

    out: Dict[str, Any] = {
        "pdf_path": pdf_path,
        "encoding": encoding_name,
        "max_tokens_per_chunk": max_tokens,
        "overlap_tokens": overlap,
        "doc_token_count": doc_token_count,
        "chunks_count": len(chunks),
        "chunks": [asdict(c) for c in chunks],
    }
    if include_full_text:
        out["full_text"] = text
    return out


# ---------- CLI ----------
def main() -> None:
    ap = argparse.ArgumentParser(description="PDF -> LLM tokens count + chunked JSON")
    ap.add_argument("pdf", help="Path to PDF")
    ap.add_argument("--out", default="pdf_tokens.json", help="Output JSON path")
    ap.add_argument("--max_tokens", type=int, default=800, help="Max tokens per chunk")
    ap.add_argument("--overlap", type=int, default=80, help="Overlap tokens between chunks")
    ap.add_argument("--encoding", default="o200k_base", help="tiktoken encoding name")
    ap.add_argument("--include_full_text", action="store_true", help="Include full extracted text in JSON")
    args = ap.parse_args()

    data = tokenize_pdf_to_json(
        args.pdf,
        max_tokens=args.max_tokens,
        overlap=args.overlap,
        encoding_name=args.encoding,
        include_full_text=args.include_full_text,
    )

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Doc token count: {data['doc_token_count']}")
    print(f"Chunks: {data['chunks_count']}")
    print(f"Wrote JSON: {args.out}")


if __name__ == "__main__":
    main()
