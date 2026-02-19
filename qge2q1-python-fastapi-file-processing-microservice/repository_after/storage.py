from __future__ import annotations

import re
from pathlib import Path

import aiofiles
from fastapi import HTTPException, UploadFile

from .config import settings


_CHUNK_SIZE = 8 * 1024


def sanitize_filename(name: str) -> str:
    name = name.strip().replace("\\", "_").replace("/", "_")
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    name = name.strip("._")
    if not name:
        name = "upload"
    return name[:255]


def job_storage_path(job_id: str, filename: str) -> Path:
    safe = sanitize_filename(filename)
    return settings.upload_dir / f"{job_id}_{safe}"


async def stream_upload_to_disk(file: UploadFile, dest: Path, max_bytes: int) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)

    total = 0
    try:
        async with aiofiles.open(dest, "wb") as out:
            while True:
                chunk = await file.read(_CHUNK_SIZE)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise HTTPException(status_code=413, detail="File too large")
                await out.write(chunk)
    except HTTPException:
        try:
            dest.unlink(missing_ok=True)
        except Exception:
            pass
        raise
    except Exception as e:
        try:
            dest.unlink(missing_ok=True)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {e}")

    return total
