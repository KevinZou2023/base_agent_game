"""Common FastAPI dependencies."""

from __future__ import annotations

from typing import Generator

from fastapi import Depends
from sqlalchemy.orm import Session

from app.agent.master_agent import MasterAgent
from app.storage.db import SessionLocal


# ---------------------------------------------------------------------------
# Database session
# ---------------------------------------------------------------------------


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Master Agent singleton
# ---------------------------------------------------------------------------


_AGENT: MasterAgent | None = None


def get_agent() -> MasterAgent:
    """Process-wide MasterAgent instance."""
    global _AGENT
    if _AGENT is None:
        _AGENT = MasterAgent()
    return _AGENT


__all__ = ["get_db", "get_agent"]
