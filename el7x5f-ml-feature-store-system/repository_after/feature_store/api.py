from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from .registry import FeatureRegistry, RegistrySettings
from .serving import RedisOnlineStore, RedisOnlineStoreSettings
from .dsl import FeatureSource, FeatureMetadata, Feature, SQLTransform


class FeatureSummary(BaseModel):
    name: str
    version: str
    description: str
    owner: str
    tags: List[str]
    entity_keys: List[str]
    event_timestamp: str
    source: Dict[str, Any]
    transform: Dict[str, Any]
    depends_on: List[str]
    feature_schema: Dict[str, Any] = Field(default_factory=dict, alias="schema")
    default_value: Optional[Any] = None


class GetOnlineRequest(BaseModel):
    feature_set: str
    entity_key: str
    feature_names: List[str]
    max_age_seconds: Optional[int] = None


class GetOnlineBatchRequest(BaseModel):
    feature_set: str
    entity_keys: List[str]
    feature_names: List[str]
    max_age_seconds: Optional[int] = None


class RegisterFeatureRequest(BaseModel):
    name: str
    version: str = "v1"
    description: str
    owner: str
    tags: List[str] = []
    entity_keys: List[str]
    event_timestamp: str
    source: Dict[str, Any]
    transform: Dict[str, Any]
    depends_on: List[str] = []
    feature_schema: Dict[str, Any] = Field(default_factory=dict, alias="schema")
    default_value: Optional[Any] = None


@dataclass(frozen=True)
class AppSettings:
    database_url: str
    redis_url: str


def create_app(settings: AppSettings) -> FastAPI:
    registry = FeatureRegistry(RegistrySettings(database_url=settings.database_url))
    registry.create_schema()
    online = RedisOnlineStore(RedisOnlineStoreSettings(redis_url=settings.redis_url))

    app = FastAPI(title="Feature Store", version="0.1.0")

    def get_registry() -> FeatureRegistry:
        return registry

    def get_online() -> RedisOnlineStore:
        return online

    @app.get("/health")
    def health() -> Dict[str, str]:
        return {"status": "ok"}

    @app.get("/features", response_model=List[FeatureSummary])
    def list_features(reg: FeatureRegistry = Depends(get_registry)):
        return reg.list_features()

    @app.get("/features/{name}", response_model=FeatureSummary)
    def get_feature(name: str, version: str = "v1", reg: FeatureRegistry = Depends(get_registry)):
        try:
            f = reg.get(name=name, version=version)
        except Exception as e:
            raise HTTPException(status_code=404, detail="Feature not found")

        # Return as summary dict
        d = reg.list_features()
        for it in d:
            if it["name"] == name and it["version"] == version:
                return it
        raise HTTPException(status_code=404, detail="Feature not found")

    @app.post("/online/get")
    def online_get(req: GetOnlineRequest, store: RedisOnlineStore = Depends(get_online)):
        return store.get_features(
            feature_set=req.feature_set,
            entity_key=req.entity_key,
            feature_names=req.feature_names,
            defaults=None,
            max_age_seconds=req.max_age_seconds,
        )

    @app.post("/online/get_batch")
    def online_get_batch(req: GetOnlineBatchRequest, store: RedisOnlineStore = Depends(get_online)):
        return store.get_features_batch(
            feature_set=req.feature_set,
            entity_keys=req.entity_keys,
            feature_names=req.feature_names,
            defaults=None,
            max_age_seconds=req.max_age_seconds,
        )

    @app.get("/lineage")
    def lineage(reg: FeatureRegistry = Depends(get_registry)):
        g = reg.lineage_graph()
        return {"nodes": list(g.nodes()), "edges": [{"from": u, "to": v} for u, v in g.edges()]}

    @app.post("/features/register")
    def register_feature(req: RegisterFeatureRequest, reg: FeatureRegistry = Depends(get_registry)):
        src = FeatureSource(
            name=req.source.get("name", "source"),
            kind=req.source.get("kind", "sql"),
            identifier=req.source.get("identifier", ""),
        )
        if req.transform.get("kind") != "sql":
            raise HTTPException(status_code=400, detail="Only sql transforms are supported via REST")
        tx = SQLTransform(sql=req.transform.get("sql", ""))

        f = Feature(
            name=req.name,
            entity_keys=tuple(req.entity_keys),
            event_timestamp=req.event_timestamp,
            source=src,
            transform=tx,
            metadata=FeatureMetadata(
                description=req.description,
                owner=req.owner,
                tags=tuple(req.tags),
                version=req.version,
            ),
            depends_on=tuple(req.depends_on),
            schema=req.feature_schema,
            default_value=req.default_value,
        )
        reg.register(f)
        return {"status": "registered", "name": req.name, "version": req.version}

    @app.get("/ui", response_class=HTMLResponse)
    def web_ui(reg: FeatureRegistry = Depends(get_registry)):
        features = reg.list_features()
        rows = "".join(
            f"<tr><td>{f['name']}</td><td>{f['version']}</td><td>{f['owner']}</td><td>{f['description']}</td></tr>"
            for f in features
        )
        html = f"""
        <html>
          <head><title>Feature Store UI</title></head>
          <body>
            <h1>Feature Registry</h1>
            <table border='1' cellpadding='6' cellspacing='0'>
              <tr><th>Name</th><th>Version</th><th>Owner</th><th>Description</th></tr>
              {rows}
            </table>
          </body>
        </html>
        """
        return HTMLResponse(content=html)

    return app
