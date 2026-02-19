from __future__ import annotations

from datetime import datetime, timedelta, timezone

import fakeredis

from repository_after.feature_store.serving import RedisOnlineStore, RedisOnlineStoreSettings


class _Sink:
    def __init__(self):
        self.events = []

    def emit(self, *, alert_type: str, payload):
        self.events.append((alert_type, payload))


def test_online_store_get_defaults_when_missing(monkeypatch):
    import redis as redis_mod

    fake = fakeredis.FakeRedis(decode_responses=True)

    def _from_url(url, decode_responses=True):
        return fake

    monkeypatch.setattr(redis_mod.Redis, "from_url", staticmethod(_from_url))

    store = RedisOnlineStore(RedisOnlineStoreSettings(redis_url="redis://does-not-matter/0"))

    out = store.get_features(
        feature_set="fs",
        entity_key="u1",
        feature_names=["f1", "f2"],
        defaults={"f1": 0, "f2": "na"},
        max_age_seconds=None,
    )

    assert out == {"f1": 0, "f2": "na"}


def test_online_store_staleness_returns_defaults(monkeypatch):
    import redis as redis_mod

    fake = fakeredis.FakeRedis(decode_responses=True)

    def _from_url(url, decode_responses=True):
        return fake

    monkeypatch.setattr(redis_mod.Redis, "from_url", staticmethod(_from_url))

    sink = _Sink()
    store = RedisOnlineStore(RedisOnlineStoreSettings(redis_url="redis://does-not-matter/0", alert_sink=sink))

    old_time = datetime.now(tz=timezone.utc) - timedelta(seconds=3600)
    store.write_features(
        feature_set="fs",
        entity_key="u1",
        values={"f1": 123},
        event_time=old_time,
    )

    out = store.get_features(
        feature_set="fs",
        entity_key="u1",
        feature_names=["f1"],
        defaults={"f1": 0},
        max_age_seconds=10,
    )
    assert out == {"f1": 0}
    assert sink.events and sink.events[0][0] == "feature_stale"


def test_online_store_batch(monkeypatch):
    import redis as redis_mod

    fake = fakeredis.FakeRedis(decode_responses=True)

    def _from_url(url, decode_responses=True):
        return fake

    monkeypatch.setattr(redis_mod.Redis, "from_url", staticmethod(_from_url))

    store = RedisOnlineStore(RedisOnlineStoreSettings(redis_url="redis://does-not-matter/0"))

    now = datetime.now(tz=timezone.utc)
    store.write_features(feature_set="fs", entity_key="u1", values={"f1": 1}, event_time=now)
    store.write_features(feature_set="fs", entity_key="u2", values={"f1": 2}, event_time=now)

    out = store.get_features_batch(
        feature_set="fs",
        entity_keys=["u1", "u2", "u3"],
        feature_names=["f1"],
        defaults={"f1": 0},
    )

    assert out["u1"]["f1"] == "1"
    assert out["u2"]["f1"] == "2"
    assert out["u3"]["f1"] == 0
