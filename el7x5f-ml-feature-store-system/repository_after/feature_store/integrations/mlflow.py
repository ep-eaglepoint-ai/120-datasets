from __future__ import annotations

from typing import Any, Dict, Optional, Sequence

from ..dsl import Feature


def _require_mlflow():
    try:
        import mlflow  # type: ignore

        return mlflow
    except Exception as e:  # pragma: no cover
        raise RuntimeError(
            "MLflow is required for this integration (dependency missing)."
        ) from e


def log_feature_definition(*, feature: Feature, extra_tags: Optional[Dict[str, Any]] = None) -> None:
    """Log a feature definition into the current MLflow run.

    This is intentionally minimal: it records feature metadata and transform info
    as MLflow tags so experiments can be traced back to feature versions.
    """

    mlflow = _require_mlflow()

    tags: Dict[str, Any] = {
        "feature.name": feature.name,
        "feature.version": feature.metadata.version,
        "feature.owner": feature.metadata.owner,
        "feature.description": feature.metadata.description,
        "feature.entity_keys": ",".join(feature.entity_keys),
        "feature.event_timestamp": feature.event_timestamp,
        "feature.source.kind": feature.source.kind,
        "feature.source.identifier": feature.source.identifier,
    }
    if feature.metadata.tags:
        tags["feature.tags"] = ",".join(feature.metadata.tags)
    if feature.depends_on:
        tags["feature.depends_on"] = ",".join(feature.depends_on)
    if extra_tags:
        tags.update({str(k): v for k, v in extra_tags.items()})

    mlflow.set_tags(tags)


def log_feature_stats(*, feature: Feature, stats: Dict[str, Any], prefix: str = "feature_stats") -> None:
    """Log feature stats as MLflow metrics (numeric) and params (strings)."""

    mlflow = _require_mlflow()

    for k, v in stats.items():
        key = f"{prefix}.{feature.name}.{k}"
        if isinstance(v, (int, float)):
            mlflow.log_metric(key, float(v))
        else:
            mlflow.log_param(key, str(v))
