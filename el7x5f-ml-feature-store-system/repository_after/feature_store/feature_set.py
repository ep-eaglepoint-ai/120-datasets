from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Mapping, Optional, Sequence

import pandas as pd

from .pit_join import point_in_time_join_pandas


@dataclass(frozen=True)
class FeatureSet:
    name: str
    entity_keys: Sequence[str]
    event_timestamp: str
    feature_names: Sequence[str]

    def build_training_dataframe_pandas(
        self,
        *,
        labels: pd.DataFrame,
        label_time_col: str,
        features: pd.DataFrame,
        feature_time_col: str,
    ) -> pd.DataFrame:
        return point_in_time_join_pandas(
            labels=labels,
            features=features,
            entity_keys=self.entity_keys,
            label_time_col=label_time_col,
            feature_time_col=feature_time_col,
            feature_cols=self.feature_names,
        )
