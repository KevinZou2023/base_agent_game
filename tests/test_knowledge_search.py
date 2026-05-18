"""Integration test for the knowledge_search tool.

Requires:
  - DASHSCOPE_API_KEY set in .env
  - `python scripts/seed_data.py` has been run (vector store populated)

If either is missing, tests are skipped instead of failing.
"""

from __future__ import annotations

import pytest

from app.config import settings
from app.storage.vector_db import get_vector_store
from app.tools.knowledge_search import knowledge_search


@pytest.fixture(scope="module")
def populated_store():
    if not settings.dashscope_api_key:
        pytest.skip("DASHSCOPE_API_KEY not set; skipping live embedding tests.")
    store = get_vector_store()
    if store.count() == 0:
        pytest.skip("Vector store is empty; run `python scripts/seed_data.py` first.")
    return store


def test_search_returns_hits(populated_store):
    result = knowledge_search("过乌时间太长会怎样", top_k=3, store=populated_store)
    assert result.hits, "Expected at least one hit"
    # Top hit should be related to wu_too_long
    top = result.hits[0]
    assert (
        top.metadata.get("risk_tag") == "wu_too_long"
        or "过乌" in top.document
        or "wu" in top.document.lower()
    ), f"Top hit unexpected: {top.metadata} | {top.document[:120]}"


def test_search_with_entry_type_filter(populated_store):
    result = knowledge_search(
        "薯莨浓度",
        top_k=5,
        entry_type="failure_case",
        store=populated_store,
    )
    assert result.hits
    for hit in result.hits:
        assert hit.metadata.get("entry_type") == "failure_case"


def test_search_with_risk_tag_filter(populated_store):
    result = knowledge_search(
        "底色出问题",
        top_k=3,
        risk_tag="base_color_too_light",
        store=populated_store,
    )
    # Must be at least one and all must match the filter
    assert result.hits
    for hit in result.hits:
        assert hit.metadata.get("risk_tag") == "base_color_too_light"


def test_search_with_stage_filter(populated_store):
    result = knowledge_search(
        "晒太阳",
        top_k=3,
        stage="sun_dry",
        store=populated_store,
    )
    for hit in result.hits:
        assert hit.metadata.get("stage") == "sun_dry"


def test_search_handles_unknown_query(populated_store):
    # An off-topic query should still return results (semantic search never returns empty),
    # but distances should be larger.
    result = knowledge_search("how to deploy kubernetes pod", top_k=2, store=populated_store)
    assert isinstance(result.hits, list)
