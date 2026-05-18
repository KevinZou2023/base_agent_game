"""POST /api/v1/master/chat — Master Agent dialogue endpoint."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agent.master_agent import MasterAgent
from app.api.deps import get_agent, get_db
from app.data.schemas import (
    AgentResponse,
    LearningEvent,
    MasterChatRequest,
)
from app.storage.db import LearningEventRow, User
from app.utils.logger import logger


router = APIRouter(prefix="/api/v1/master", tags=["master"])


@router.post(
    "/chat",
    response_model=AgentResponse,
    summary="师傅 Agent 对话",
    description=(
        "传入玩家当前状态和操作事件，返回师傅口语化反馈、命中的风险标签、"
        "推荐改进动作和教学策略。Agent 会在内部自主决定调用知识检索、教学策略、"
        "学习路径推荐等工具。"
    ),
)
def master_chat(
    body: MasterChatRequest,
    agent: MasterAgent = Depends(get_agent),
    db: Session = Depends(get_db),
) -> AgentResponse:
    try:
        response = agent.respond(
            player_state=body.player_state,
            message=body.message,
            operation_event=body.operation_event,
        )
    except Exception as e:
        logger.exception("Master chat failed: {}", e)
        raise HTTPException(status_code=500, detail=f"agent error: {e}")

    # Persist any newly-recorded learning events (the agent mutates player_state.history in place)
    _persist_history(db, body.player_state.player_id, body.player_state.history)
    return response


def _persist_history(db: Session, player_id: str, history: list[LearningEvent]) -> None:
    """Upsert User and append learning history rows that aren't yet persisted."""
    if not player_id:
        return
    user = db.get(User, player_id)
    if user is None:
        user = User(player_id=player_id)
        db.add(user)
        db.flush()

    # Insert events from history that occurred in the last 10 seconds (i.e. just added).
    cutoff = datetime.utcnow().timestamp() - 10.0
    for ev in history:
        if ev.occurred_at.timestamp() < cutoff:
            continue
        if not ev.risk_tag:
            continue
        db.add(LearningEventRow(
            player_id=player_id,
            stage=ev.stage.value,
            risk_tag=ev.risk_tag,
            note=ev.note,
            occurred_at=ev.occurred_at,
        ))
    db.commit()
