from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, Protocol


class AlertSink(Protocol):
    def emit(self, *, alert_type: str, payload: Dict[str, Any]) -> None:
        ...


class NoopAlertSink:
    def emit(self, *, alert_type: str, payload: Dict[str, Any]) -> None:
        return


@dataclass(frozen=True)
class Thresholds:
    max_staleness_seconds: Optional[int] = None
    psi_threshold: Optional[float] = None
