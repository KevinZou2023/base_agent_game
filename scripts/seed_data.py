"""Seed the Xiangyunsha vector DB and initialize SQLite.

Run with:
    python scripts/seed_data.py            # incremental upsert
    python scripts/seed_data.py --reset    # wipe and re-insert
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Make sure the app package is on sys.path when running as a script
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.config import settings
from app.storage.db import init_db
from app.storage.vector_db import get_vector_store
from app.utils.logger import logger


DATA_FILES = [
    PROJECT_ROOT / "data" / "processed" / "craft_steps.json",
    PROJECT_ROOT / "data" / "processed" / "materials.json",
    PROJECT_ROOT / "data" / "processed" / "parameters.json",
    PROJECT_ROOT / "data" / "processed" / "failure_cases.json",
]


# ---------------------------------------------------------------------------
# Document construction
# ---------------------------------------------------------------------------


def _flatten(value: Any) -> str:
    """Render nested dict/list values as plain text for embedding."""
    if isinstance(value, dict):
        return " ".join(f"{k}: {_flatten(v)}" for k, v in value.items())
    if isinstance(value, list):
        return "; ".join(_flatten(v) for v in value)
    return str(value)


def entry_to_document(entry: dict[str, Any]) -> str:
    """Turn one JSON entry into a single embedding-friendly text blob."""

    et = entry.get("entry_type", "unknown")
    parts: list[str] = [f"[{et}]"]

    # Most informative fields first
    for key in (
        "step_name",
        "material_name",
        "parameter",
        "symptom",
        "purpose",
        "description",
        "procedure",
        "root_cause",
        "master_explanation",
        "impact_on_quality",
    ):
        if key in entry and entry[key]:
            parts.append(_flatten(entry[key]))

    # Cautions / corrections are useful too
    for key in ("cautions", "correction_actions"):
        if key in entry and entry[key]:
            parts.append(_flatten(entry[key]))

    return " | ".join(parts)


def entry_to_metadata(entry: dict[str, Any]) -> dict[str, Any]:
    """Extract scalar metadata fields Chroma can index."""

    meta: dict[str, Any] = {"entry_type": entry.get("entry_type", "unknown")}
    for k in ("step_id", "material_id", "parameter_id", "case_id"):
        if k in entry:
            meta["id_key"] = entry[k]
            meta["id_field"] = k
            break
    for k in ("stage", "risk_tag", "severity", "category"):
        if k in entry and isinstance(entry[k], (str, int, float, bool)):
            meta[k] = entry[k]
    source = entry.get("source") or {}
    if source:
        meta["source_type"] = source.get("source_type", "")
        meta["confidence"] = float(source.get("confidence", 0.8))
        meta["reviewed_status"] = source.get("reviewed_status", "pending")
    return meta


def entry_to_id(entry: dict[str, Any]) -> str:
    """Stable unique ID for each entry."""
    for k in ("step_id", "material_id", "parameter_id", "case_id"):
        if k in entry:
            return f"{entry['entry_type']}::{entry[k]}"
    raise ValueError(f"Entry without a recognizable ID field: {entry}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def load_all_entries() -> list[dict[str, Any]]:
    all_entries: list[dict[str, Any]] = []
    for path in DATA_FILES:
        if not path.exists():
            logger.warning("Skipping missing file: {}", path)
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            all_entries.extend(data)
        else:
            logger.warning("Expected a list in {}, got {}", path, type(data))
    return all_entries


def main(reset: bool = False) -> None:
    if not settings.dashscope_api_key:
        logger.error(
            "DASHSCOPE_API_KEY is not set. Edit .env and set DASHSCOPE_API_KEY before running."
        )
        sys.exit(1)

    logger.info("Initializing SQLite at {}", settings.sqlite_uri)
    init_db()
    logger.info("SQLite tables ready.")

    store = get_vector_store()
    if reset:
        store.reset()

    entries = load_all_entries()
    logger.info("Loaded {} entries from data/processed/", len(entries))

    if not entries:
        logger.warning("No entries to ingest.")
        return

    ids: list[str] = []
    docs: list[str] = []
    metas: list[dict[str, Any]] = []
    seen: set[str] = set()
    for entry in entries:
        try:
            eid = entry_to_id(entry)
        except ValueError as e:
            logger.warning("Skipping entry: {}", e)
            continue
        if eid in seen:
            logger.warning("Duplicate ID skipped: {}", eid)
            continue
        seen.add(eid)
        ids.append(eid)
        docs.append(entry_to_document(entry))
        metas.append(entry_to_metadata(entry))

    # Chroma's `add` raises if any ID already exists; use upsert pattern via reset+add
    # For incremental adds, filter out already-present IDs.
    if not reset:
        try:
            existing = set(store._collection.get(ids=ids)["ids"])  # type: ignore[attr-defined]
        except Exception:
            existing = set()
        if existing:
            keep = [i for i, d, m in zip(ids, docs, metas) if i not in existing]
            keep_set = set(keep)
            ids, docs, metas = zip(  # type: ignore[assignment]
                *((i, d, m) for i, d, m in zip(ids, docs, metas) if i in keep_set)
            ) if keep else ([], [], [])
            ids = list(ids)
            docs = list(docs)
            metas = list(metas)
            if not ids:
                logger.info("All entries already in store; nothing to add.")

    if ids:
        store.add(ids=ids, documents=docs, metadatas=metas)

    total = store.count()
    logger.info("Vector store now contains {} entries.", total)

    # Sanity check: search
    sample = store.search("过乌时间太长会怎样", top_k=3)
    logger.info("Sample query '过乌时间太长会怎样' returned {} hits:", len(sample.hits))
    for hit in sample.hits:
        logger.info("  - distance={:.4f} tags={} doc={}", hit.distance, hit.metadata, hit.document[:80])


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Drop the collection before inserting")
    args = parser.parse_args()
    main(reset=args.reset)
