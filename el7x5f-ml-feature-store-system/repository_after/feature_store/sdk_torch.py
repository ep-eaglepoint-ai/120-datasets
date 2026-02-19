from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Optional, Sequence

try:
    import torch
    from torch.utils.data import Dataset
except Exception:  # pragma: no cover
    torch = None
    Dataset = object

import pandas as pd

from .sdk_pandas import PandasFeatureFetcher


@dataclass
class FeatureStoreDataset(Dataset):
    """PyTorch Dataset that fetches features on-the-fly."""

    entities: pd.DataFrame
    entity_key_col: str
    feature_names: Sequence[str]
    fetcher: PandasFeatureFetcher
    defaults: Optional[Mapping[str, Any]] = None
    max_age_seconds: Optional[int] = None

    def __len__(self) -> int:
        return len(self.entities)

    def __getitem__(self, idx: int):
        row = self.entities.iloc[[idx]]
        df = self.fetcher.fetch(
            entities=row,
            entity_key_col=self.entity_key_col,
            feature_names=self.feature_names,
            defaults=self.defaults,
            max_age_seconds=self.max_age_seconds,
        )
        values = df[self.feature_names].iloc[0].to_list()
        if torch is None:  # pragma: no cover
            return values
        return torch.tensor(values)
