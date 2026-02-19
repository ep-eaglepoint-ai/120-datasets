from __future__ import annotations

import pandas as pd

from feature_store.pit_join import point_in_time_join_pandas


def test_point_in_time_join_picks_latest_past_value():
    labels = pd.DataFrame(
        [
            {"user_id": "u1", "label_time": "2026-01-01T00:00:10Z", "y": 1},
            {"user_id": "u1", "label_time": "2026-01-01T00:00:30Z", "y": 0},
        ]
    )
    features = pd.DataFrame(
        [
            {"user_id": "u1", "feature_time": "2026-01-01T00:00:05Z", "f": 100},
            {"user_id": "u1", "feature_time": "2026-01-01T00:00:20Z", "f": 200},
        ]
    )

    out = point_in_time_join_pandas(
        labels=labels,
        features=features,
        entity_keys=["user_id"],
        label_time_col="label_time",
        feature_time_col="feature_time",
        feature_cols=["f"],
    )

    assert out.loc[0, "f"] == 100
    assert out.loc[1, "f"] == 200


def test_point_in_time_join_prevents_leakage_future_feature_is_not_used():
    labels = pd.DataFrame(
        [{"user_id": "u1", "label_time": "2026-01-01T00:00:10Z", "y": 1}]
    )
    features = pd.DataFrame(
        [{"user_id": "u1", "feature_time": "2026-01-01T00:00:11Z", "f": 999}]
    )

    out = point_in_time_join_pandas(
        labels=labels,
        features=features,
        entity_keys=["user_id"],
        label_time_col="label_time",
        feature_time_col="feature_time",
        feature_cols=["f"],
    )

    assert pd.isna(out.loc[0, "f"])
