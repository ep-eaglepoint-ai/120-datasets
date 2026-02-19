from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Protocol


class OfflineStore(Protocol):
    def write_feature_frame(
        self,
        *,
        df,
        feature_name: str,
        version: str,
        mode: str = "append",
        partition_cols: Optional[list[str]] = None,
    ) -> str:
        ...


@dataclass(frozen=True)
class ParquetOfflineStoreSettings:
    root_path: str


class ParquetOfflineStore:
    """Simple offline store backed by Parquet on a filesystem.

    Intended for local/dev and as a reference implementation.
    """

    def __init__(self, settings: ParquetOfflineStoreSettings):
        self._settings = settings

    def write_feature_frame(
        self,
        *,
        df,
        feature_name: str,
        version: str,
        mode: str = "append",
        partition_cols: Optional[list[str]] = None,
    ) -> str:
        base = Path(self._settings.root_path)
        path = base / feature_name / version
        path.mkdir(parents=True, exist_ok=True)

        writer = df.write
        if partition_cols:
            writer = writer.partitionBy(*partition_cols)

        writer.mode(mode).parquet(str(path))
        return str(path)
