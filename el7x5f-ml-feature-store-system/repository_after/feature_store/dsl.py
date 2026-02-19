from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Set, Tuple, Union


@dataclass(frozen=True)
class FeatureMetadata:
    description: str
    owner: str
    tags: Tuple[str, ...] = ()
    version: str = "v1"


@dataclass(frozen=True)
class FeatureSource:
    """Binding to a data source.

    In production you can back this by:
    - a SQL table/view (offline)
    - a Kafka topic (streaming)

    This class is intentionally lightweight; richer connectors can wrap it.
    """

    name: str
    kind: str  # "sql" | "kafka" | "custom"
    identifier: str  # table name, topic name, etc.


class Transform:
    kind: str


@dataclass(frozen=True)
class SQLTransform(Transform):
    sql: str
    kind: str = "sql"


@dataclass(frozen=True)
class PythonTransform(Transform):
    func: Callable[[Any], Any]
    kind: str = "python"


_SQL_DEP_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}")


def infer_dependencies_from_sql(sql: str) -> Tuple[str, ...]:
    """Infer feature dependencies from SQL.

    Convention: downstream SQL may reference other features using placeholders
    like `{{upstream_feature_name}}`. This keeps dependency tracking explicit
    while avoiding full SQL parsing.
    """

    deps = tuple(sorted(set(_SQL_DEP_RE.findall(sql or ""))))
    return deps


def depends_on(*feature_names: str):
    """Decorator to attach feature dependencies to Python transform callables."""

    def _decorator(func: Callable[[Any], Any]):
        setattr(func, "__feature_dependencies__", tuple(feature_names))
        return func

    return _decorator


@dataclass
class Feature:
    """Declarative feature definition.

    A Feature may depend on other Features. Dependencies are used for lineage.

    Minimal fields to support training-serving consistency:
    - entity_keys: the join keys (e.g. user_id)
    - event_timestamp: column name used for point-in-time joins
    """

    name: str
    entity_keys: Tuple[str, ...]
    event_timestamp: str
    source: FeatureSource
    transform: Union[SQLTransform, PythonTransform]
    metadata: FeatureMetadata
    depends_on: Tuple[str, ...] = ()
    default_value: Optional[Any] = None
    schema: Optional[Dict[str, Any]] = None

    def dependency_set(self) -> Set[str]:
        return set(self.depends_on)


def feature(
    *,
    name: str,
    entity_keys: Sequence[str],
    event_timestamp: str,
    source: FeatureSource,
    transform: Union[SQLTransform, PythonTransform],
    description: str,
    owner: str,
    tags: Sequence[str] = (),
    version: str = "v1",
    depends_on: Sequence[Any] = (),
    default_value: Optional[Any] = None,
    schema: Optional[Dict[str, Any]] = None,
) -> Feature:
    """Convenience constructor for Feature definitions."""

    inferred: Tuple[str, ...] = ()
    if not depends_on:
        if isinstance(transform, SQLTransform):
            inferred = infer_dependencies_from_sql(transform.sql)
        elif isinstance(transform, PythonTransform):
            inferred = tuple(getattr(transform.func, "__feature_dependencies__", ()))

    deps: List[str] = []
    for d in (list(depends_on) if depends_on else list(inferred)):
        if isinstance(d, Feature):
            deps.append(d.name)
        else:
            deps.append(str(d))

    return Feature(
        name=name,
        entity_keys=tuple(entity_keys),
        event_timestamp=event_timestamp,
        source=source,
        transform=transform,
        metadata=FeatureMetadata(
            description=description,
            owner=owner,
            tags=tuple(tags),
            version=version,
        ),
        depends_on=tuple(deps),
        default_value=default_value,
        schema=schema,
    )
