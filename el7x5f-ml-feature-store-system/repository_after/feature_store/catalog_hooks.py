from __future__ import annotations

from typing import Any, Dict, Protocol


class DataCatalogHook(Protocol):
    def publish_feature(self, feature_definition: Dict[str, Any]) -> None:
        ...


class NoopCatalogHook:
    def publish_feature(self, feature_definition: Dict[str, Any]) -> None:
        return
