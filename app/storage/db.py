"""SQLite database via SQLAlchemy 2.0 — user state, artworks, scoring records."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
    sessionmaker,
)

from app.config import settings


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# ORM models
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"

    player_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    nickname: Mapped[str] = mapped_column(String(64), default="新学徒")
    level: Mapped[str] = mapped_column(String(16), default="beginner")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    artworks: Mapped[list["Artwork"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    history: Mapped[list["LearningEventRow"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Artwork(Base):
    __tablename__ = "artworks"

    artwork_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    player_id: Mapped[str] = mapped_column(ForeignKey("users.player_id"), index=True)
    task_theme: Mapped[str | None] = mapped_column(String(128), nullable=True)
    parameters_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    prompt_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending/done/failed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="artworks")
    score: Mapped["ScoreRecord | None"] = relationship(
        back_populates="artwork", uselist=False, cascade="all, delete-orphan"
    )


class ScoreRecord(Base):
    __tablename__ = "score_records"

    artwork_id: Mapped[str] = mapped_column(ForeignKey("artworks.artwork_id"), primary_key=True)
    process_score: Mapped[float] = mapped_column(Float, default=0.0)
    pattern_score: Mapped[float] = mapped_column(Float, default=0.0)
    color_score: Mapped[float] = mapped_column(Float, default=0.0)
    culture_score: Mapped[float] = mapped_column(Float, default=0.0)
    progress_score: Mapped[float] = mapped_column(Float, default=0.0)
    deductions_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    master_feedback: Mapped[str] = mapped_column(Text, default="")
    next_task_recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    artwork: Mapped[Artwork] = relationship(back_populates="score")


class LearningEventRow(Base):
    __tablename__ = "learning_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[str] = mapped_column(ForeignKey("users.player_id"), index=True)
    stage: Mapped[str] = mapped_column(String(32))
    risk_tag: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="history")


# ---------------------------------------------------------------------------
# Engine / session factory
# ---------------------------------------------------------------------------


def _ensure_parent_dir(uri: str) -> None:
    """Make sure sqlite:///path/to/feiyi.db has its directory created."""
    prefix = "sqlite:///"
    if uri.startswith(prefix):
        Path(uri[len(prefix):]).parent.mkdir(parents=True, exist_ok=True)


_ensure_parent_dir(settings.sqlite_uri)
engine = create_engine(
    settings.sqlite_uri,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def init_db() -> None:
    """Create all tables. Safe to call repeatedly."""
    Base.metadata.create_all(engine)


def get_session() -> Session:
    """Dependency-injection style session factory."""
    return SessionLocal()


__all__ = [
    "Base",
    "User",
    "Artwork",
    "ScoreRecord",
    "LearningEventRow",
    "engine",
    "SessionLocal",
    "init_db",
    "get_session",
]
