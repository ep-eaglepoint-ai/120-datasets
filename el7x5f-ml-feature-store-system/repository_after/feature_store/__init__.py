"""Feature store library package.

This package provides:
- Declarative DSL for features
- SQLAlchemy-backed registry (PostgreSQL)
- Online serving (Redis)
- Training data generation (point-in-time correct joins)
- FastAPI app for discovery and serving

Optional integrations (Spark/Faust/Great Expectations) are designed to be
importable without requiring those heavy dependencies at runtime.
"""

from .dsl import (
    Feature,
    FeatureMetadata,
    FeatureSource,
    PythonTransform,
    SQLTransform,
    feature,
)
from .registry import FeatureRegistry, RegistrySettings
from .serving import OnlineStore, RedisOnlineStore, RedisTimeSeriesOnlineStore
from .pit_join import point_in_time_join_pandas, point_in_time_join_spark
from .offline_store import OfflineStore, ParquetOfflineStore, ParquetOfflineStoreSettings
from .alerts import AlertSink, NoopAlertSink, Thresholds
from .feature_set import FeatureSet
from .validation import FeatureValidator
from .drift import population_stability_index, DriftResult

__all__ = [
    "Feature",
    "FeatureMetadata",
    "FeatureSource",
    "PythonTransform",
    "SQLTransform",
    "feature",
    "FeatureRegistry",
    "RegistrySettings",
    "OnlineStore",
    "RedisOnlineStore",
    "RedisTimeSeriesOnlineStore",
    "point_in_time_join_pandas",
    "point_in_time_join_spark",
    "OfflineStore",
    "ParquetOfflineStore",
    "ParquetOfflineStoreSettings",
    "AlertSink",
    "NoopAlertSink",
    "Thresholds",
    "FeatureSet",
    "FeatureValidator",
    "population_stability_index",
    "DriftResult",
]
