"""GET / PUT /api/v1/user/{player_id}/state — player progress sync."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.data.schemas import (
    ArtworkSummary,
    UserStateResponse,
    UserStateUpdate,
)
from app.storage.db import Artwork, LearningEventRow, User


router = APIRouter(prefix="/api/v1/user", tags=["user_state"])


@router.get(
    "/{player_id}/state",
    response_model=UserStateResponse,
    summary="拉取玩家状态、作品列表与最近风险标签",
)
def get_user_state(
    player_id: str,
    db: Session = Depends(get_db),
    artwork_limit: int = 20,
    risk_limit: int = 10,
) -> UserStateResponse:
    user = db.get(User, player_id)
    if user is None:
        # Auto-create new players on first read so the front-end doesn't have to do a 'register' step
        user = User(player_id=player_id)
        db.add(user)
        db.commit()
        db.refresh(user)

    artworks = (
        db.query(Artwork)
        .filter(Artwork.player_id == player_id)
        .order_by(Artwork.created_at.desc())
        .limit(artwork_limit)
        .all()
    )
    recent_risks = (
        db.query(LearningEventRow.risk_tag)
        .filter(LearningEventRow.player_id == player_id)
        .filter(LearningEventRow.risk_tag.isnot(None))
        .order_by(LearningEventRow.occurred_at.desc())
        .limit(risk_limit)
        .all()
    )

    return UserStateResponse(
        player_id=user.player_id,
        nickname=user.nickname,
        level=user.level,
        created_at=user.created_at,
        artworks=[
            ArtworkSummary(
                artwork_id=a.artwork_id,
                task_theme=a.task_theme,
                image_url=a.image_url,
                status=a.status,
                created_at=a.created_at,
            )
            for a in artworks
        ],
        recent_risk_tags=[r[0] for r in recent_risks if r[0]],
    )


@router.put(
    "/{player_id}/state",
    response_model=UserStateResponse,
    summary="更新玩家昵称 / 等级",
)
def update_user_state(
    player_id: str,
    body: UserStateUpdate,
    db: Session = Depends(get_db),
) -> UserStateResponse:
    user = db.get(User, player_id)
    if user is None:
        user = User(player_id=player_id)
        db.add(user)
        db.flush()

    if body.nickname is not None:
        user.nickname = body.nickname
    if body.level is not None:
        user.level = body.level
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    return get_user_state(player_id, db)
