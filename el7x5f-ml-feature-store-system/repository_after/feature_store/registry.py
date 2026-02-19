from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import networkx as nx
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .db import DatabaseSettings, create_engine_and_session_factory
from .dsl import Feature, FeatureMetadata, FeatureSource, PythonTransform, SQLTransform
from .models import Base, FeatureDefinitionModel, FeatureLineageEdgeModel, FeatureProcessingStateModel, FeatureStatsModel


@dataclass(frozen=True)
class RegistrySettings:
    database_url: str


class FeatureRegistry:
    """SQLAlchemy-backed registry.

    Stores feature definitions (schemas, metadata) + lineage edges.
    """

    def __init__(self, settings: RegistrySettings):
        self._settings = settings
        self._engine, self._SessionLocal = create_engine_and_session_factory(
            DatabaseSettings(database_url=settings.database_url)
        )

    @property
    def engine(self):
        return self._engine

    def create_schema(self) -> None:
        Base.metadata.create_all(self._engine)

    def drop_schema(self) -> None:
        Base.metadata.drop_all(self._engine)

    def _session(self) -> Session:
        return self._SessionLocal()

    def register(self, feature: Feature, *, catalog_hook=None) -> None:
        """Upsert a feature definition and its lineage edges."""

        with self._session() as session:
            existing = session.execute(
                select(FeatureDefinitionModel).where(
                    FeatureDefinitionModel.name == feature.name,
                    FeatureDefinitionModel.version == feature.metadata.version,
                )
            ).scalar_one_or_none()

            row = FeatureDefinitionModel(
                name=feature.name,
                version=feature.metadata.version,
                description=feature.metadata.description,
                owner=feature.metadata.owner,
                tags={"tags": list(feature.metadata.tags)},
                entity_keys={"entity_keys": list(feature.entity_keys)},
                event_timestamp=feature.event_timestamp,
                source={
                    "name": feature.source.name,
                    "kind": feature.source.kind,
                    "identifier": feature.source.identifier,
                },
                transform=self._serialize_transform(feature),
                depends_on={"depends_on": list(feature.depends_on)},
                schema=feature.schema or {},
                default_value=None if feature.default_value is None else {"value": feature.default_value},
            )

            if existing is None:
                session.add(row)
            else:
                existing.description = row.description
                existing.owner = row.owner
                existing.tags = row.tags
                existing.entity_keys = row.entity_keys
                existing.event_timestamp = row.event_timestamp
                existing.source = row.source
                existing.transform = row.transform
                existing.depends_on = row.depends_on
                existing.schema = row.schema
                existing.default_value = row.default_value

                session.execute(
                    delete(FeatureLineageEdgeModel).where(
                        FeatureLineageEdgeModel.downstream == feature.name
                    )
                )

            for upstream in feature.depends_on:
                session.add(FeatureLineageEdgeModel(upstream=upstream, downstream=feature.name))

            session.commit()

        if catalog_hook is not None:
            catalog_hook.publish_feature(
                {
                    "name": feature.name,
                    "version": feature.metadata.version,
                    "description": feature.metadata.description,
                    "owner": feature.metadata.owner,
                    "tags": list(feature.metadata.tags),
                    "entity_keys": list(feature.entity_keys),
                    "event_timestamp": feature.event_timestamp,
                    "source": {
                        "name": feature.source.name,
                        "kind": feature.source.kind,
                        "identifier": feature.source.identifier,
                    },
                    "transform": self._serialize_transform(feature),
                    "depends_on": list(feature.depends_on),
                    "schema": feature.schema or {},
                    "default_value": feature.default_value,
                }
            )

    def get(self, name: str, version: Optional[str] = None) -> Feature:
        version = version or "v1"
        with self._session() as session:
            row = session.execute(
                select(FeatureDefinitionModel).where(
                    FeatureDefinitionModel.name == name,
                    FeatureDefinitionModel.version == version,
                )
            ).scalar_one()

            return self._deserialize_feature(row)

    def list_features(self) -> List[Dict[str, Any]]:
        with self._session() as session:
            rows = session.execute(select(FeatureDefinitionModel)).scalars().all()
            return [
                {
                    "name": r.name,
                    "version": r.version,
                    "description": r.description,
                    "owner": r.owner,
                    "tags": r.tags.get("tags", []),
                    "entity_keys": r.entity_keys.get("entity_keys", []),
                    "event_timestamp": r.event_timestamp,
                    "source": r.source,
                    "transform": r.transform,
                    "depends_on": r.depends_on.get("depends_on", []),
                    "schema": r.schema or {},
                    "default_value": None if r.default_value is None else r.default_value.get("value"),
                }
                for r in rows
            ]

    def set_processing_state(
        self,
        *,
        feature_name: str,
        feature_version: str,
        state_key: str,
        state: Dict[str, Any],
    ) -> None:
        with self._session() as session:
            existing = session.execute(
                select(FeatureProcessingStateModel).where(
                    FeatureProcessingStateModel.feature_name == feature_name,
                    FeatureProcessingStateModel.feature_version == feature_version,
                    FeatureProcessingStateModel.state_key == state_key,
                )
            ).scalar_one_or_none()

            if existing is None:
                session.add(
                    FeatureProcessingStateModel(
                        feature_name=feature_name,
                        feature_version=feature_version,
                        state_key=state_key,
                        state=state,
                    )
                )
            else:
                existing.state = state

            session.commit()

    def get_processing_state(
        self,
        *,
        feature_name: str,
        feature_version: str,
        state_key: str,
    ) -> Optional[Dict[str, Any]]:
        with self._session() as session:
            row = session.execute(
                select(FeatureProcessingStateModel).where(
                    FeatureProcessingStateModel.feature_name == feature_name,
                    FeatureProcessingStateModel.feature_version == feature_version,
                    FeatureProcessingStateModel.state_key == state_key,
                )
            ).scalar_one_or_none()
            return None if row is None else row.state

    def lineage_graph(self) -> nx.DiGraph:
        g = nx.DiGraph()
        with self._session() as session:
            edges = session.execute(select(FeatureLineageEdgeModel)).scalars().all()
            for e in edges:
                g.add_edge(e.upstream, e.downstream)
        return g

    def record_stats(self, feature_name: str, feature_version: str, stats: Dict[str, Any]) -> None:
        with self._session() as session:
            session.add(
                FeatureStatsModel(feature_name=feature_name, feature_version=feature_version, stats=stats)
            )
            session.commit()

    def latest_stats(self, feature_name: str, feature_version: str) -> Optional[Dict[str, Any]]:
        with self._session() as session:
            row = session.execute(
                select(FeatureStatsModel)
                .where(
                    FeatureStatsModel.feature_name == feature_name,
                    FeatureStatsModel.feature_version == feature_version,
                )
                .order_by(FeatureStatsModel.computed_at.desc())
            ).scalars().first()
            return None if row is None else row.stats

    def _serialize_transform(self, feature: Feature) -> Dict[str, Any]:
        t = feature.transform
        if isinstance(t, SQLTransform):
            return {"kind": "sql", "sql": t.sql}
        if isinstance(t, PythonTransform):
            # Do not attempt to pickle code for registry; store a reference.
            return {"kind": "python", "callable": getattr(t.func, "__name__", "<callable>")}
        raise TypeError(f"Unsupported transform type: {type(t)}")

    def _deserialize_feature(self, row: FeatureDefinitionModel) -> Feature:
        source = FeatureSource(
            name=row.source["name"],
            kind=row.source["kind"],
            identifier=row.source["identifier"],
        )
        transform = row.transform
        if transform.get("kind") == "sql":
            tx = SQLTransform(sql=transform["sql"])
        else:
            # For python transforms, the registry stores only a reference.
            # Execution is handled by pipelines that bind actual callables.
            tx = SQLTransform(sql="-- python transform reference stored in registry")

        md = FeatureMetadata(
            description=row.description,
            owner=row.owner,
            tags=tuple(row.tags.get("tags", [])),
            version=row.version,
        )

        return Feature(
            name=row.name,
            entity_keys=tuple(row.entity_keys.get("entity_keys", [])),
            event_timestamp=row.event_timestamp,
            source=source,
            transform=tx,
            metadata=md,
            depends_on=tuple(row.depends_on.get("depends_on", [])),
            default_value=None if row.default_value is None else row.default_value.get("value"),
            schema=row.schema or {},
        )
