from __future__ import annotations

import pytest

from repository_after.feature_store.pit_join import point_in_time_join_spark
from repository_after.feature_store.processing_batch import SparkBatchProcessor, SparkBatchSettings


def test_point_in_time_join_spark_requires_pyspark():
    with pytest.raises(RuntimeError):
        point_in_time_join_spark(
            labels_df=None,
            features_df=None,
            entity_keys=["user_id"],
            label_time_col="label_time",
            feature_time_col="feature_time",
            feature_cols=["f"],
        )


def test_spark_batch_processor_requires_pyspark():
    proc = SparkBatchProcessor(SparkBatchSettings())
    with pytest.raises(RuntimeError):
        proc.compute(
            spark=None,
            feature=None,
            sources={},
        )
