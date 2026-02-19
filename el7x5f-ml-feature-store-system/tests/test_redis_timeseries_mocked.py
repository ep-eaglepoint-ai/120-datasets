from __future__ import annotations

from datetime import datetime, timezone

from repository_after.feature_store.serving import (
    RedisTimeSeriesOnlineStore,
    RedisTimeSeriesOnlineStoreSettings,
)


def test_redis_timeseries_write_and_get(monkeypatch):
    import redis as redis_mod

    # Emulate RedisTimeSeries commands by storing a simple key -> (ts,value)
    ts_state: dict[str, tuple[int, object]] = {}

    class FakePipeline:
        def __init__(self, client):
            self._client = client
            self._ops = []

        def execute_command(self, cmd, *args):
            self._ops.append((cmd, args))
            return self

        def execute(self):
            out = []
            for cmd, args in self._ops:
                out.append(self._client.execute_command(cmd, *args))
            self._ops.clear()
            return out

    class FakeRedis:
        def pipeline(self):
            return FakePipeline(self)

        def execute_command(self, cmd, *args):
            cmd_u = str(cmd).upper()
            if cmd_u == "TS.CREATE":
                key = str(args[0])
                ts_state.setdefault(key, (0, None))
                return "OK"
            if cmd_u == "TS.ADD":
                key, ts_ms, value = str(args[0]), int(args[1]), args[2]
                ts_state[key] = (ts_ms, value)
                return ts_ms
            if cmd_u == "TS.GET":
                key = str(args[0])
                return ts_state.get(key)
            raise NotImplementedError(cmd_u)

    fake = FakeRedis()

    def _from_url(url, decode_responses=True):
        return fake

    monkeypatch.setattr(redis_mod.Redis, "from_url", staticmethod(_from_url))

    store = RedisTimeSeriesOnlineStore(RedisTimeSeriesOnlineStoreSettings(redis_url="redis://x/0"))

    t = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    store.write_features(feature_set="fs", entity_key="u1", values={"f1": 123}, event_time=t)

    out = store.get_features(
        feature_set="fs",
        entity_key="u1",
        feature_names=["f1"],
        defaults={"f1": 0},
        max_age_seconds=None,
    )
    assert out["f1"] == 123 or out["f1"] == "123"
