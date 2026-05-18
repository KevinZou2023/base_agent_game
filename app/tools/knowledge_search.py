"""knowledge_search_tool — semantic search over the Xiangyunsha knowledge base."""

from __future__ import annotations

from typing import Any

from app.data.schemas import SearchResult
from app.storage.vector_db import VectorStore, get_vector_store
from app.utils.logger import logger


def knowledge_search(
    query: str,
    top_k: int = 5,
    entry_type: str | None = None,
    risk_tag: str | None = None,
    stage: str | None = None,
    store: VectorStore | None = None,
) -> SearchResult:
    """Semantic search against the Xiangyunsha knowledge base.

    Args:
        query: Natural language query, e.g. "过乌时间过长会怎样".
        top_k: How many hits to return.
        entry_type: Optional filter (`craft_step` / `material` / `parameter` / `failure_case`).
        risk_tag: Optional filter for failure cases.
        stage: Optional filter for craft stage.
        store: Optional store instance (for tests). Defaults to the singleton.

    Returns:
        SearchResult with hits sorted by ascending distance (closer = more relevant).
    """

    vector_store = store or get_vector_store()
    filters: dict[str, Any] = {}
    if entry_type:
        filters["entry_type"] = entry_type
    if risk_tag:
        filters["risk_tag"] = risk_tag
    if stage:
        filters["stage"] = stage

    # Chroma `where` expects None when there are no filters
    where = filters if filters else None
    result = vector_store.search(query=query, top_k=top_k, filters=where)
    logger.info("knowledge_search '{}' returned {} hits", query, len(result.hits))
    return result


__all__ = ["knowledge_search"]
