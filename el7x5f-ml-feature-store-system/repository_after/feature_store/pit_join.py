from __future__ import annotations

from typing import List, Sequence

import pandas as pd


def point_in_time_join_pandas(
    *,
    labels: pd.DataFrame,
    features: pd.DataFrame,
    entity_keys: Sequence[str],
    label_time_col: str,
    feature_time_col: str,
    feature_cols: Sequence[str],
) -> pd.DataFrame:
    """Point-in-time correct join (pandas).

    For each label row, picks the latest feature row for the same entity where
    feature_time <= label_time.

    This prevents leakage by construction.
    """

    if labels.empty:
        return labels.copy()

    for col in list(entity_keys) + [label_time_col]:
        if col not in labels.columns:
            raise KeyError(f"labels missing column: {col}")
    for col in list(entity_keys) + [feature_time_col] + list(feature_cols):
        if col not in features.columns:
            raise KeyError(f"features missing column: {col}")

    left = labels.copy()
    right = features.copy()

    left[label_time_col] = pd.to_datetime(left[label_time_col], utc=True)
    right[feature_time_col] = pd.to_datetime(right[feature_time_col], utc=True)

    # Sort for merge_asof
    left = left.sort_values(list(entity_keys) + [label_time_col])
    right = right.sort_values(list(entity_keys) + [feature_time_col])

    joined = left
    # merge_asof supports a single "by" list for exact match on entity keys
    joined = pd.merge_asof(
        joined,
        right[list(entity_keys) + [feature_time_col] + list(feature_cols)],
        left_on=label_time_col,
        right_on=feature_time_col,
        by=list(entity_keys),
        direction="backward",
        allow_exact_matches=True,
    )

    # Drop the feature timestamp unless user explicitly needs it
    return joined.drop(columns=[feature_time_col])


def point_in_time_join_spark(
    *,
    labels_df,
    features_df,
    entity_keys: Sequence[str],
    label_time_col: str,
    feature_time_col: str,
    feature_cols: Sequence[str],
):
    """Point-in-time correct join (Spark).

    Uses a left join with condition feature_time <= label_time, then selects the
    latest feature per label row via a window ordered by feature_time desc.
    """

    try:
        from pyspark.sql import Window
        import pyspark.sql.functions as F
    except Exception as e:  # pragma: no cover
        raise RuntimeError("PySpark is required for point_in_time_join_spark") from e

    # Cast time columns to timestamp for correct ordering/comparisons.
    labels_cast = labels_df.withColumn(label_time_col, F.to_timestamp(F.col(label_time_col)))
    feats_cast = features_df.withColumn(feature_time_col, F.to_timestamp(F.col(feature_time_col)))

    # Assign stable row id to each label row so we can window per label
    labels = labels_cast.withColumn("__label_row_id", F.monotonically_increasing_id())

    join_cond = [labels[k] == feats_cast[k] for k in entity_keys] + [
        feats_cast[feature_time_col] <= labels[label_time_col]
    ]

    joined = labels.join(feats_cast, on=join_cond, how="left")

    w = Window.partitionBy("__label_row_id").orderBy(F.col(feature_time_col).desc_nulls_last())
    ranked = joined.withColumn("__rn", F.row_number().over(w))
    best = ranked.where(F.col("__rn") == 1)

    # Select original label columns plus requested feature columns
    label_cols = [c for c in labels_df.columns]
    out_cols = label_cols + list(feature_cols)
    return best.select(*out_cols)
