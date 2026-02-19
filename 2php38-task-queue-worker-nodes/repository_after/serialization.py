"""Pluggable serialization system supporting JSON, MessagePack, and pickle."""
from __future__ import annotations

import gzip
import json
import pickle
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, Optional, Type

try:
    import msgpack
    HAS_MSGPACK = True
except ImportError:
    HAS_MSGPACK = False


class SerializationFormat(str, Enum):
    """Supported serialization formats."""
    JSON = "json"
    MSGPACK = "msgpack"
    PICKLE = "pickle"


class Serializer(ABC):
    """Abstract base class for serializers."""
    
    @abstractmethod
    def serialize(self, data: Any) -> bytes:
        """Serialize data to bytes."""
        pass
    
    @abstractmethod
    def deserialize(self, data: bytes) -> Any:
        """Deserialize bytes to data."""
        pass


class JSONSerializer(Serializer):
    """JSON serializer implementation."""
    
    def serialize(self, data: Any) -> bytes:
        return json.dumps(data, default=str).encode("utf-8")
    
    def deserialize(self, data: bytes) -> Any:
        return json.loads(data.decode("utf-8"))


class MessagePackSerializer(Serializer):
    """MessagePack serializer implementation."""
    
    def serialize(self, data: Any) -> bytes:
        if not HAS_MSGPACK:
            raise ImportError("msgpack is not installed")
        return msgpack.packb(data, use_bin_type=True, default=str)
    
    def deserialize(self, data: bytes) -> Any:
        if not HAS_MSGPACK:
            raise ImportError("msgpack is not installed")
        return msgpack.unpackb(data, raw=False)


class PickleSerializer(Serializer):
    """Pickle serializer implementation."""
    
    def serialize(self, data: Any) -> bytes:
        return pickle.dumps(data)
    
    def deserialize(self, data: bytes) -> Any:
        return pickle.loads(data)


class CompressedSerializer(Serializer):
    """Wrapper that adds gzip compression to any serializer."""
    
    def __init__(self, inner: Serializer, compression_level: int = 6):
        self._inner = inner
        self._level = compression_level
    
    def serialize(self, data: Any) -> bytes:
        raw = self._inner.serialize(data)
        return gzip.compress(raw, compresslevel=self._level)
    
    def deserialize(self, data: bytes) -> Any:
        raw = gzip.decompress(data)
        return self._inner.deserialize(raw)


class SerializerFactory:
    """Factory for creating serializers."""
    
    _serializers: Dict[SerializationFormat, Type[Serializer]] = {
        SerializationFormat.JSON: JSONSerializer,
        SerializationFormat.MSGPACK: MessagePackSerializer,
        SerializationFormat.PICKLE: PickleSerializer,
    }
    
    @classmethod
    def create(
        cls,
        format: SerializationFormat = SerializationFormat.JSON,
        compress: bool = False,
        compression_level: int = 6,
    ) -> Serializer:
        """Create a serializer instance."""
        serializer_cls = cls._serializers.get(format)
        if not serializer_cls:
            raise ValueError(f"Unknown serialization format: {format}")
        
        serializer = serializer_cls()
        
        if compress:
            serializer = CompressedSerializer(serializer, compression_level)
        
        return serializer
    
    @classmethod
    def register(cls, format: SerializationFormat, serializer_cls: Type[Serializer]):
        """Register a custom serializer."""
        cls._serializers[format] = serializer_cls


class PayloadEncoder:
    """Handles job payload encoding/decoding with versioning support."""
    
    def __init__(
        self,
        serializer: Optional[Serializer] = None,
        default_format: SerializationFormat = SerializationFormat.JSON,
    ):
        self._serializer = serializer or SerializerFactory.create(default_format)
        self._format = default_format
    
    def encode(self, payload: Any, version: int = 1) -> bytes:
        """Encode a payload with version information."""
        envelope = {
            "version": version,
            "format": self._format.value,
            "data": payload,
        }
        return self._serializer.serialize(envelope)
    
    def decode(self, data: bytes) -> tuple[Any, int]:
        """Decode a payload and return (data, version)."""
        envelope = self._serializer.deserialize(data)
        return envelope["data"], envelope["version"]
    
    def migrate(self, data: Any, from_version: int, to_version: int, migrators: Dict[int, callable]) -> Any:
        """Migrate payload from one version to another."""
        current = data
        for v in range(from_version, to_version):
            if v in migrators:
                current = migrators[v](current)
        return current
