from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Mapping, Optional, Sequence

import pandas as pd

from .serving import OnlineStore


@dataclass(frozen=True)
class PandasFeatureFetcher:
    online_store: OnlineStore
    feature_set: str

    def fetch(
        self,
        *,
        entities: pd.DataFrame,
        entity_key_col: str,
        feature_names: Sequence[str],
        defaults: Optional[Mapping[str, Any]] = None,
        max_age_seconds: Optional[int] = None,
    ) -> pd.DataFrame:
        rows: List[Dict[str, Any]] = []
        for ek in entities[entity_key_col].astype(str).tolist():
            feats = self.online_store.get_features(
                feature_set=self.feature_set,
                entity_key=ek,
                feature_names=feature_names,
                defaults=defaults,
                max_age_seconds=max_age_seconds,
            )
            rows.append({entity_key_col: ek, **feats})
        return entities.merge(pd.DataFrame(rows), on=entity_key_col, how="left")
