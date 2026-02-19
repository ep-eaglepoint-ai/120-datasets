from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Mapping, Sequence

import pandas as pd

from .dsl import Feature, SQLTransform, PythonTransform
from .offline_store import OfflineStore
from .serving import OnlineStore
from .registry import FeatureRegistry


@dataclass(frozen=True)
class SparkBatchSettings:
    watermark_delay: str = "1 day"
    watermark_state_key: str = "batch_watermark"


class SparkBatchProcessor:
    """Batch feature computation using PySpark.

    This module is intentionally import-light; PySpark is optional.
    """

    def __init__(self, settings: SparkBatchSettings):
        self._settings = settings

    def plan_execution_order(self, features: Sequence[Feature]) -> List[Feature]:
        """Topologically sort features by declared dependencies.

        Only considers dependencies that are present in `features`.
        """

        by_name = {f.name: f for f in features}
        deps: Dict[str, set[str]] = {
            f.name: set(d for d in f.depends_on if d in by_name and d != f.name) for f in features
        }

        ready = sorted([n for n, ds in deps.items() if not ds])
        out: List[Feature] = []

        while ready:
            name = ready.pop(0)
            out.append(by_name[name])
            for other, ds in deps.items():
                if name in ds:
                    ds.remove(name)
                    if not ds and by_name[other] not in out and other not in ready:
                        ready.append(other)
                        ready.sort()

        if len(out) != len(features):
            remaining = [n for n, ds in deps.items() if ds]
            raise ValueError(f"Cyclic or missing dependencies among: {remaining}")

        return out

    def _parse_watermark_delay_seconds(self) -> int:
        td = pd.to_timedelta(self._settings.watermark_delay)
        return int(td.total_seconds())

    def incremental_compute_and_materialize(
        self,
        *,
        spark,
        registry: FeatureRegistry,
        feature: Feature,
        sources: Mapping[str, Any],
        offline_store: OfflineStore,
        online_store: Optional[OnlineStore] = None,
        feature_set: str = "default",
        event_time_col: Optional[str] = None,
        mode: str = "append",
    ) -> Dict[str, Any]:
        """Incremental batch computation with watermark tracking.

        Watermark logic:
        - Reads the last processed watermark from the registry.
        - Processes source rows with event_time > watermark and <= (now - delay).
        - Updates watermark to the max event_time actually processed.
        """

        try:
            import pyspark.sql.functions as F
        except Exception as e:  # pragma: no cover
            raise RuntimeError("PySpark is required for SparkBatchProcessor") from e

        feature_version = feature.metadata.version
        event_time_col = event_time_col or feature.event_timestamp

        state = registry.get_processing_state(
            feature_name=feature.name,
            feature_version=feature_version,
            state_key=self._settings.watermark_state_key,
        )
        last_watermark = None if state is None else state.get("watermark")

        now = datetime.now(tz=timezone.utc)
        cutoff = now - pd.to_timedelta(self._settings.watermark_delay)

        watermark_ts = None
        if last_watermark:
            watermark_ts = datetime.fromisoformat(last_watermark)

        # Filter the primary source by watermark/cutoff when possible.
        filtered_sources: Dict[str, Any] = {}
        for view_name, df in sources.items():
            if view_name == feature.source.name and event_time_col in getattr(df, "columns", []):
                df = df.where(F.col(event_time_col) <= F.lit(cutoff))
                if watermark_ts is not None:
                    df = df.where(F.col(event_time_col) > F.lit(watermark_ts))
            filtered_sources[view_name] = df

        df = self.compute(
            spark=spark,
            feature=feature,
            sources=filtered_sources,
            watermark_col=None,
            watermark_ts=None,
        )

        # Determine the max event time processed for watermark update.
        max_row = df.select(F.max(F.col(event_time_col)).alias("mx")).collect()[0]
        mx = max_row["mx"]

        result = self.materialize(
            df=df,
            feature=feature,
            offline_store=offline_store,
            online_store=online_store,
            feature_set=feature_set,
            mode=mode,
        )

        if mx is not None:
            if hasattr(mx, "tzinfo") and mx.tzinfo is None:
                mx = mx.replace(tzinfo=timezone.utc)
            registry.set_processing_state(
                feature_name=feature.name,
                feature_version=feature_version,
                state_key=self._settings.watermark_state_key,
                state={"watermark": mx.isoformat()},
            )

        result["watermark_updated_to"] = None if mx is None else mx.isoformat()
        result["cutoff"] = cutoff.isoformat()
        return result

    def backfill_compute_and_materialize(
        self,
        *,
        spark,
        feature: Feature,
        sources: Mapping[str, Any],
        offline_store: OfflineStore,
        online_store: Optional[OnlineStore] = None,
        feature_set: str = "default",
        start_time: datetime,
        end_time: datetime,
        event_time_col: Optional[str] = None,
        mode: str = "append",
    ) -> Dict[str, Any]:
        """Backfill historical features for a bounded time range."""

        try:
            import pyspark.sql.functions as F
        except Exception as e:  # pragma: no cover
            raise RuntimeError("PySpark is required for SparkBatchProcessor") from e

        event_time_col = event_time_col or feature.event_timestamp
        filtered_sources: Dict[str, Any] = {}

        for view_name, df in sources.items():
            if view_name == feature.source.name and event_time_col in getattr(df, "columns", []):
                df = df.where(F.col(event_time_col) >= F.lit(start_time)).where(F.col(event_time_col) < F.lit(end_time))
            filtered_sources[view_name] = df

        df = self.compute(spark=spark, feature=feature, sources=filtered_sources)
        result = self.materialize(
            df=df,
            feature=feature,
            offline_store=offline_store,
            online_store=online_store,
            feature_set=feature_set,
            mode=mode,
        )
        result["backfill_range"] = {"start": start_time.isoformat(), "end": end_time.isoformat()}
        return result

    def compute(
        self,
        *,
        spark,
        feature: Feature,
        sources: Mapping[str, Any],
        watermark_col: Optional[str] = None,
        watermark_ts: Optional[Any] = None,
    ):
        """Compute a feature DataFrame from named Spark sources.

        - `sources` is a mapping of view name -> Spark DataFrame.
        - If `watermark_col` and `watermark_ts` are provided, the source view
          matching `feature.source.name` is filtered to strictly newer records.
        """

        try:
            import pyspark.sql.functions as F
        except Exception as e:  # pragma: no cover
            raise RuntimeError("PySpark is required for SparkBatchProcessor") from e

        # Register temp views
        for view_name, df in sources.items():
            df_to_use = df
            if (
                view_name == feature.source.name
                and watermark_col is not None
                and watermark_ts is not None
                and watermark_col in df.columns
            ):
                df_to_use = df.where(F.col(watermark_col) > F.lit(watermark_ts))
            df_to_use.createOrReplaceTempView(view_name)

        if isinstance(feature.transform, SQLTransform):
            return spark.sql(feature.transform.sql)

        if isinstance(feature.transform, PythonTransform):
            # For Spark execution, treat the python transform as a callable that
            # receives a dict of sources and returns a DataFrame.
            return feature.transform.func(sources)

        raise TypeError(f"Unsupported transform type: {type(feature.transform)}")

    def materialize(
        self,
        *,
        df,
        feature: Feature,
        offline_store: OfflineStore,
        online_store: Optional[OnlineStore] = None,
        feature_set: str = "default",
        mode: str = "append",
    ) -> Dict[str, Any]:
        """Write computed features to offline store and optionally to online store.

        Assumes `df` contains entity keys + event timestamp + the feature column.
        """

        version = feature.metadata.version
        offline_path = offline_store.write_feature_frame(
            df=df,
            feature_name=feature.name,
            version=version,
            mode=mode,
        )

        if online_store is not None:
            self._materialize_online(df=df, feature=feature, online_store=online_store, feature_set=feature_set)

        return {"offline_path": offline_path, "feature": feature.name, "version": version}

    def _materialize_online(self, *, df, feature: Feature, online_store: OnlineStore, feature_set: str) -> None:
        # Scalable-ish: write per partition without collecting entire DF.
        entity_keys = list(feature.entity_keys)
        ts_col = feature.event_timestamp
        feat_col = feature.name

        def write_partition(rows_iter):
            from datetime import datetime, timezone

            for row in rows_iter:
                ek = "|".join(str(row[k]) for k in entity_keys)
                event_time = row[ts_col]
                if isinstance(event_time, str):
                    s = event_time.strip()
                    if s.endswith("Z"):
                        s = s[:-1] + "+00:00"
                    event_time = datetime.fromisoformat(s)
                if getattr(event_time, "tzinfo", None) is None:
                    event_time = event_time.replace(tzinfo=timezone.utc)
                online_store.write_features(
                    feature_set=feature_set,
                    entity_key=ek,
                    values={feat_col: row[feat_col]},
                    event_time=event_time,
                )

        df.select(*entity_keys, ts_col, feat_col).rdd.foreachPartition(write_partition)
