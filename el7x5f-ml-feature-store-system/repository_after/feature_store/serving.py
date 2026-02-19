from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Mapping, Optional, Protocol, Sequence

from .alerts import AlertSink, NoopAlertSink


class OnlineStore(Protocol):
    def write_features(
        self,
        *,
        feature_set: str,
        entity_key: str,
        values: Mapping[str, Any],
        event_time: datetime,
    ) -> None:
        ...

    def get_features(
        self,
        *,
        feature_set: str,
        entity_key: str,
        feature_names: Sequence[str],
        defaults: Optional[Mapping[str, Any]] = None,
        max_age_seconds: Optional[int] = None,
    ) -> Dict[str, Any]:
        ...

    def get_features_batch(
        self,
        *,
        feature_set: str,
        entity_keys: Sequence[str],
        feature_names: Sequence[str],
        defaults: Optional[Mapping[str, Any]] = None,
        max_age_seconds: Optional[int] = None,
    ) -> Dict[str, Dict[str, Any]]:
        ...


@dataclass(frozen=True)
class RedisOnlineStoreSettings:
    redis_url: str
    key_prefix: str = "fs"
    alert_sink: Optional[AlertSink] = None


class RedisOnlineStore:
    """Low-latency Redis-backed online store.

    Uses Redis hashes + a per-entity freshness timestamp.
    This works everywhere without requiring RedisTimeSeries module.

    You can swap to RedisTimeSeries later by implementing a different writer/reader.
    """

    def __init__(self, settings: RedisOnlineStoreSettings):
        import redis

        self._settings = settings
        self._client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
        self._alert_sink = settings.alert_sink or NoopAlertSink()

    def _entity_hash_key(self, feature_set: str, entity_key: str) -> str:
        return f"{self._settings.key_prefix}:{feature_set}:{entity_key}:values"

    def _entity_meta_key(self, feature_set: str, entity_key: str) -> str:
        return f"{self._settings.key_prefix}:{feature_set}:{entity_key}:meta"

    def write_features(
        self,
        *,
        feature_set: str,
        entity_key: str,
        values: Mapping[str, Any],
        event_time: datetime,
    ) -> None:
        if event_time.tzinfo is None:
            event_time = event_time.replace(tzinfo=timezone.utc)
        ts = int(event_time.timestamp())

        hkey = self._entity_hash_key(feature_set, entity_key)
        mkey = self._entity_meta_key(feature_set, entity_key)

        pipe = self._client.pipeline()
        # Values are stored as strings by redis-py; keep it simple.
        pipe.hset(hkey, mapping={k: "" if v is None else str(v) for k, v in values.items()})
        pipe.hset(mkey, mapping={"event_time": str(ts)})
        pipe.execute()

    def get_features(
        self,
        *,
        feature_set: str,
        entity_key: str,
        feature_names: Sequence[str],
        defaults: Optional[Mapping[str, Any]] = None,
        max_age_seconds: Optional[int] = None,
    ) -> Dict[str, Any]:
        defaults = defaults or {}

        hkey = self._entity_hash_key(feature_set, entity_key)
        mkey = self._entity_meta_key(feature_set, entity_key)

        pipe = self._client.pipeline()
        pipe.hmget(hkey, list(feature_names))
        pipe.hget(mkey, "event_time")
        values, event_time_s = pipe.execute()

        now_ts = int(datetime.now(tz=timezone.utc).timestamp())
        if max_age_seconds is not None and event_time_s is not None:
            age = now_ts - int(event_time_s)
            if age > max_age_seconds:
                # staleness => return defaults
                self._alert_sink.emit(
                    alert_type="feature_stale",
                    payload={
                        "feature_set": feature_set,
                        "entity_key": entity_key,
                        "age_seconds": age,
                        "max_age_seconds": max_age_seconds,
                        "feature_names": list(feature_names),
                    },
                )
                return {name: defaults.get(name) for name in feature_names}

        out: Dict[str, Any] = {}
        for name, raw in zip(feature_names, values):
            if raw is None:
                out[name] = defaults.get(name)
            else:
                out[name] = raw
        return out

    def get_features_batch(
        self,
        *,
        feature_set: str,
        entity_keys: Sequence[str],
        feature_names: Sequence[str],
        defaults: Optional[Mapping[str, Any]] = None,
        max_age_seconds: Optional[int] = None,
    ) -> Dict[str, Dict[str, Any]]:
        return {
            ek: self.get_features(
                feature_set=feature_set,
                entity_key=ek,
                feature_names=feature_names,
                defaults=defaults,
                max_age_seconds=max_age_seconds,
            )
            for ek in entity_keys
        }


@dataclass(frozen=True)
class RedisTimeSeriesOnlineStoreSettings:
    redis_url: str
    key_prefix: str = "fs"
    alert_sink: Optional[AlertSink] = None


class RedisTimeSeriesOnlineStore:
    """Online store using RedisTimeSeries module.

    Data model:
    - One time series per (feature_set, entity_key, feature_name)
      key: {prefix}:{feature_set}:{entity_key}:ts:{feature_name}

    This allows fetching the latest value (TS.GET) and validating freshness by
    comparing timestamps.

    Note: RedisTimeSeries must be loaded in the target Redis. For environments
    where it isn't available, prefer `RedisOnlineStore`.
    """

    def __init__(self, settings: RedisTimeSeriesOnlineStoreSettings):
        import redis

        self._settings = settings
        self._client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
        self._alert_sink = settings.alert_sink or NoopAlertSink()

    def _ts_key(self, feature_set: str, entity_key: str, feature_name: str) -> str:
        return f"{self._settings.key_prefix}:{feature_set}:{entity_key}:ts:{feature_name}"

    def write_features(
        self,
        *,
        feature_set: str,
        entity_key: str,
        values: Mapping[str, Any],
        event_time: datetime,
    ) -> None:
        if event_time.tzinfo is None:
            event_time = event_time.replace(tzinfo=timezone.utc)
        ts_ms = int(event_time.timestamp() * 1000)

        from redis.exceptions import ResponseError

        for fname, val in values.items():
            key = self._ts_key(feature_set, entity_key, fname)
            try:
                self._client.execute_command("TS.ADD", key, ts_ms, val if val is not None else "nan")
            except ResponseError as e:
                msg = str(e)
                if "TSDB: the key does not exist" in msg or "does not exist" in msg:
                    # Create then retry.
                    try:
                        self._client.execute_command("TS.CREATE", key, "DUPLICATE_POLICY", "last")
                    except ResponseError:
                        pass
                    self._client.execute_command("TS.ADD", key, ts_ms, val if val is not None else "nan")
                else:
                    raise

    def get_features(
        self,
        *,
        feature_set: str,
        entity_key: str,
        feature_names: Sequence[str],
        defaults: Optional[Mapping[str, Any]] = None,
        max_age_seconds: Optional[int] = None,
    ) -> Dict[str, Any]:
        defaults = defaults or {}

        now_ms = int(datetime.now(tz=timezone.utc).timestamp() * 1000)
        out: Dict[str, Any] = {}

        pipe = self._client.pipeline()
        keys = [self._ts_key(feature_set, entity_key, n) for n in feature_names]
        for k in keys:
            pipe.execute_command("TS.GET", k)
        results = pipe.execute()

        for name, res in zip(feature_names, results):
            if not res:
                out[name] = defaults.get(name)
                continue
            ts_ms, value = res
            if max_age_seconds is not None:
                age_s = (now_ms - int(ts_ms)) / 1000.0
                if age_s > max_age_seconds:
                    self._alert_sink.emit(
                        alert_type="feature_stale",
                        payload={
                            "feature_set": feature_set,
                            "entity_key": entity_key,
                            "age_seconds": age_s,
                            "max_age_seconds": max_age_seconds,
                            "feature_names": [name],
                        },
                    )
                    out[name] = defaults.get(name)
                    continue
            out[name] = value
        return out

    def get_features_batch(
        self,
        *,
        feature_set: str,
        entity_keys: Sequence[str],
        feature_names: Sequence[str],
        defaults: Optional[Mapping[str, Any]] = None,
        max_age_seconds: Optional[int] = None,
    ) -> Dict[str, Dict[str, Any]]:
        return {
            ek: self.get_features(
                feature_set=feature_set,
                entity_key=ek,
                feature_names=feature_names,
                defaults=defaults,
                max_age_seconds=max_age_seconds,
            )
            for ek in entity_keys
        }

