from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterable, List, Literal, Optional, Sequence

import pandas as pd

from .serving import OnlineStore


@dataclass(frozen=True)
class StreamSettings:
    app_id: str = "feature-store"
    max_lateness: str = "10 minutes"


WindowKind = Literal["tumbling", "sliding", "session"]
AggFunc = Literal["count", "sum", "avg", "percentile"]


@dataclass(frozen=True)
class WindowSpec:
    kind: WindowKind
    size: str
    step: Optional[str] = None  # only for sliding
    grace: Optional[str] = None  # lateness grace period


@dataclass(frozen=True)
class AggregationSpec:
    name: str
    func: AggFunc
    field: Optional[str] = None  # None => count(*)
    window: WindowSpec = WindowSpec(kind="tumbling", size="5 minutes")
    percentile: Optional[float] = None  # only for percentile


@dataclass(frozen=True)
class StreamFeatureSpec:
    """Declarative spec for streaming feature computation."""

    feature_set: str
    source_topic: str
    entity_key_field: str
    event_time_field: str
    aggregations: Sequence[AggregationSpec]


def _parse_timedelta_seconds(value: str) -> int:
    return int(pd.to_timedelta(value).total_seconds())


class FaustStreamProcessor:
    """Kafka + Faust streaming feature computation.

    This is a scaffolding layer suitable for production extension.
    The project keeps Faust optional so the library can be installed without Kafka.
    """

    def __init__(self, settings: StreamSettings):
        self._settings = settings

    def validate_specs(self, specs: Sequence[StreamFeatureSpec]) -> None:
        for spec in specs:
            if not spec.aggregations:
                raise ValueError("StreamFeatureSpec must include at least one aggregation")
            for agg in spec.aggregations:
                if agg.func == "count":
                    continue
                if agg.field is None:
                    raise ValueError(f"Aggregation '{agg.name}' requires 'field'")
                if agg.func == "percentile" and (agg.percentile is None or not (0 < agg.percentile < 1)):
                    raise ValueError(f"Aggregation '{agg.name}' requires percentile in (0,1)")
                if agg.window.kind == "sliding" and not agg.window.step:
                    raise ValueError(f"Sliding window for '{agg.name}' requires step")

    def build_app(
        self,
        *,
        broker: str,
        specs: Sequence[StreamFeatureSpec],
        online_store: OnlineStore,
    ):
        """Build a Faust app that consumes Kafka and writes aggregates to the online store.

        Notes:
        - This builds the topology; running the app is an operational concern.
        - Late data is handled by dropping events older than (now - max_lateness).
        """

        self.validate_specs(specs)

        try:
            import faust
        except Exception as e:  # pragma: no cover
            raise RuntimeError("Faust is required for FaustStreamProcessor") from e

        app = faust.App(self._settings.app_id, broker=broker)
        max_late_s = _parse_timedelta_seconds(self._settings.max_lateness)

        for spec in specs:
            topic = app.topic(spec.source_topic, value_type=dict)

            # One table per aggregation. Value is a small dict containing running state.
            tables = {}
            for agg in spec.aggregations:
                win = agg.window
                size_s = _parse_timedelta_seconds(win.size)

                if win.kind == "tumbling":
                    table = app.Table(f"{spec.feature_set}:{agg.name}:tumbling", default=dict).tumbling(
                        size_s, expires=size_s * 2
                    )
                elif win.kind == "sliding":
                    step_s = _parse_timedelta_seconds(win.step or "1 minute")
                    table = app.Table(f"{spec.feature_set}:{agg.name}:sliding", default=dict).hopping(
                        size_s, step=step_s, expires=size_s * 2
                    )
                else:
                    # Session windows are trickier; implement as a tumbling proxy by default.
                    table = app.Table(f"{spec.feature_set}:{agg.name}:session", default=dict).tumbling(
                        size_s, expires=size_s * 2
                    )

                tables[agg.name] = table

            @app.agent(topic)
            async def process(stream):  # pragma: no cover (requires kafka runtime)
                async for event in stream:
                    if spec.entity_key_field not in event or spec.event_time_field not in event:
                        continue

                    ek = str(event[spec.entity_key_field])
                    raw_ts = event[spec.event_time_field]
                    if isinstance(raw_ts, str):
                        s = raw_ts.strip()
                        if s.endswith("Z"):
                            s = s[:-1] + "+00:00"
                        et = datetime.fromisoformat(s)
                    else:
                        et = raw_ts
                    if getattr(et, "tzinfo", None) is None:
                        et = et.replace(tzinfo=timezone.utc)

                    now = datetime.now(tz=timezone.utc)
                    if (now - et).total_seconds() > max_late_s:
                        continue

                    updates: Dict[str, Any] = {}

                    for agg in spec.aggregations:
                        table = tables[agg.name]
                        state = dict(table[ek] or {})

                        if agg.func == "count":
                            state["count"] = int(state.get("count", 0)) + 1
                            updates[agg.name] = state["count"]
                        else:
                            val = event.get(agg.field) if agg.field else None
                            if val is None:
                                continue
                            v = float(val)
                            if agg.func == "sum":
                                state["sum"] = float(state.get("sum", 0.0)) + v
                                updates[agg.name] = state["sum"]
                            elif agg.func == "avg":
                                state["sum"] = float(state.get("sum", 0.0)) + v
                                state["count"] = int(state.get("count", 0)) + 1
                                updates[agg.name] = state["sum"] / max(state["count"], 1)
                            else:
                                # Simple (non-scalable) percentile: keep a bounded buffer.
                                buf = list(state.get("values", []))
                                buf.append(v)
                                buf = buf[-500:]
                                state["values"] = buf
                                p = float(agg.percentile or 0.5)
                                buf_sorted = sorted(buf)
                                idx = int(p * (len(buf_sorted) - 1))
                                updates[agg.name] = buf_sorted[idx] if buf_sorted else None

                        table[ek] = state

                    if updates:
                        online_store.write_features(
                            feature_set=spec.feature_set,
                            entity_key=ek,
                            values=updates,
                            event_time=et,
                        )

        return app
