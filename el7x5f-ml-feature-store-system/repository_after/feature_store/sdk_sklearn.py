from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Optional, Sequence

import numpy as np
import pandas as pd

from .sdk_pandas import PandasFeatureFetcher


@dataclass
class FeatureStoreTransformer:
    """scikit-learn compatible transformer interface.

    This transformer fetches online features given an entity key column.
    """

    fetcher: PandasFeatureFetcher
    entity_key_col: str
    feature_names: Sequence[str]
    defaults: Optional[Mapping[str, Any]] = None
    max_age_seconds: Optional[int] = None

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        if not isinstance(X, pd.DataFrame):
            X = pd.DataFrame(X)
        df = self.fetcher.fetch(
            entities=X,
            entity_key_col=self.entity_key_col,
            feature_names=self.feature_names,
            defaults=self.defaults,
            max_age_seconds=self.max_age_seconds,
        )
        return df[self.feature_names].to_numpy()
