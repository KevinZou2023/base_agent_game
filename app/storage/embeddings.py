"""DashScope embedding function for ChromaDB.

Uses `text-embedding-v3` (Aliyun) so we don't need PyTorch / sentence-transformers locally.
"""

from __future__ import annotations

import time
from typing import Iterable

import dashscope
from chromadb import EmbeddingFunction, Embeddings
from chromadb.api.types import Documents
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.utils.logger import logger


# DashScope text-embedding-v3 limits batches to 10 texts per call.
BATCH_SIZE = 10


class DashScopeEmbeddingFunction(EmbeddingFunction[Documents]):
    """Chroma-compatible embedding function backed by DashScope `text-embedding-v3`."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        batch_size: int = BATCH_SIZE,
    ) -> None:
        self.api_key = api_key or settings.dashscope_api_key
        self.model = model or settings.embedding_model
        self.batch_size = batch_size
        if not self.api_key:
            raise RuntimeError(
                "DASHSCOPE_API_KEY is not set. Add it to .env or pass api_key explicitly."
            )

    # Chroma calls __call__ with a list of strings and expects list[list[float]].
    def __call__(self, input: Documents) -> Embeddings:
        texts = list(input)
        if not texts:
            return []

        vectors: list[list[float]] = []
        for batch in _batched(texts, self.batch_size):
            vectors.extend(self._embed_batch(batch))
        return vectors

    @retry(
        wait=wait_exponential(multiplier=1, min=2, max=10),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        resp = dashscope.TextEmbedding.call(
            api_key=self.api_key,
            model=self.model,
            input=batch,
        )
        if resp.status_code != 200:
            logger.error(
                "DashScope embedding failed: status={} code={} msg={}",
                resp.status_code,
                resp.code,
                resp.message,
            )
            raise RuntimeError(f"DashScope embedding error: {resp.message}")

        # Response shape: resp.output["embeddings"] = [{"text_index": 0, "embedding": [...]}, ...]
        embeddings_data = resp.output["embeddings"]
        # Sort by text_index to make sure order matches input
        embeddings_data.sort(key=lambda x: x["text_index"])
        return [item["embedding"] for item in embeddings_data]

    # Chroma 0.5+ requires these classmethods
    @staticmethod
    def name() -> str:
        return "dashscope-text-embedding-v3"

    def get_config(self) -> dict[str, str]:
        # Don't serialize the API key
        return {"model": self.model, "batch_size": str(self.batch_size)}

    @classmethod
    def build_from_config(cls, config: dict[str, str]) -> "DashScopeEmbeddingFunction":
        return cls(
            model=config.get("model"),
            batch_size=int(config.get("batch_size", BATCH_SIZE)),
        )


def _batched(items: list[str], size: int) -> Iterable[list[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


__all__ = ["DashScopeEmbeddingFunction"]
