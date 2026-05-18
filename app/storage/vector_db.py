"""ChromaDB wrapper for the Xiangyunsha knowledge base."""

from __future__ import annotations

from typing import Any

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import settings
from app.data.schemas import SearchHit, SearchResult
from app.storage.embeddings import DashScopeEmbeddingFunction
from app.utils.logger import logger


COLLECTION_NAME = "xiangyunsha_knowledge"


class VectorStore:
    """Persistent ChromaDB store using DashScope embeddings."""

    def __init__(
        self,
        path: str | None = None,
        collection_name: str = COLLECTION_NAME,
    ) -> None:
        self.path = str(settings.chroma_path) if path is None else path
        settings.chroma_path.mkdir(parents=True, exist_ok=True)
        self._client = chromadb.PersistentClient(
            path=self.path,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self._embedding_fn = DashScopeEmbeddingFunction()
        self.collection_name = collection_name
        self._collection = self._client.get_or_create_collection(
            name=collection_name,
            embedding_function=self._embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )

    def reset(self) -> None:
        """Drop and recreate the collection. Use before re-seeding."""
        try:
            self._client.delete_collection(self.collection_name)
        except Exception:
            pass
        self._collection = self._client.get_or_create_collection(
            name=self.collection_name,
            embedding_function=self._embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info("Vector store collection '{}' reset", self.collection_name)

    def add(
        self,
        ids: list[str],
        documents: list[str],
        metadatas: list[dict[str, Any]],
    ) -> None:
        if not ids:
            return
        self._collection.add(ids=ids, documents=documents, metadatas=metadatas)
        logger.info("Inserted {} entries into '{}'", len(ids), self.collection_name)

    def count(self) -> int:
        return self._collection.count()

    def search(
        self,
        query: str,
        top_k: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> SearchResult:
        """Semantic search. `filters` is a Chroma `where` dict, e.g. {"entry_type": "failure_case"}."""

        result = self._collection.query(
            query_texts=[query],
            n_results=top_k,
            where=filters,
        )
        hits: list[SearchHit] = []
        documents = (result.get("documents") or [[]])[0]
        metadatas = (result.get("metadatas") or [[]])[0]
        distances = (result.get("distances") or [[0.0] * len(documents)])[0]
        for doc, meta, dist in zip(documents, metadatas, distances):
            hits.append(SearchHit(document=doc, metadata=meta or {}, distance=float(dist)))
        return SearchResult(query=query, hits=hits)


_default_store: VectorStore | None = None


def get_vector_store() -> VectorStore:
    """Process-wide singleton."""
    global _default_store
    if _default_store is None:
        _default_store = VectorStore()
    return _default_store


__all__ = ["VectorStore", "get_vector_store", "COLLECTION_NAME"]
