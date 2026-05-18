"""GET /api/v1/scoring/{artwork_id} — multi-dimensional scoring + master feedback."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.data.schemas import (
    ScoringReport,
    XiangyunshaParameters,
)
from app.storage.db import Artwork, LearningEventRow, ScoreRecord
from app.tools.scoring import score_artwork
from app.tools.teaching_feedback import build_master_feedback


router = APIRouter(prefix="/api/v1/scoring", tags=["scoring"])


@router.get(
    "/{artwork_id}",
    response_model=ScoringReport,
    summary="获取作品多维评分与师傅点评",
    description=(
        "根据 artwork_id 拉取已生成的作品，调用规则评分 + LLM 生成师傅口语化总评，"
        "并推荐下一轮练习。"
    ),
)
def get_scoring(
    artwork_id: str,
    db: Session = Depends(get_db),
) -> ScoringReport:
    artwork = db.get(Artwork, artwork_id)
    if artwork is None:
        raise HTTPException(status_code=404, detail=f"artwork {artwork_id} not found")

    parameters = XiangyunshaParameters(**artwork.parameters_json)

    # Pull recent risk history for progress scoring
    recent = (
        db.query(LearningEventRow)
        .filter(LearningEventRow.player_id == artwork.player_id)
        .order_by(LearningEventRow.occurred_at.desc())
        .limit(20)
        .all()
    )
    previous_tags = [row.risk_tag for row in recent if row.risk_tag]

    report = score_artwork(
        artwork_id=artwork_id,
        parameters=parameters,
        previous_risks=previous_tags,
    )
    # Enrich with master feedback (LLM) + next-task recommendation
    report = build_master_feedback(
        report=report,
        parameters=parameters,
        task_theme=artwork.task_theme,
        recent_risk_tags=previous_tags,
    )

    # Persist (upsert)
    existing = db.get(ScoreRecord, artwork_id)
    if existing is None:
        rec = ScoreRecord(
            artwork_id=artwork_id,
            process_score=report.scores.process_score,
            pattern_score=report.scores.pattern_score,
            color_score=report.scores.color_score,
            culture_score=report.scores.culture_score,
            progress_score=report.scores.progress_score,
            deductions_json=[d.model_dump() for d in report.deductions],
            master_feedback=report.master_feedback,
            next_task_recommendation=report.next_task_recommendation,
        )
        db.add(rec)
    else:
        existing.process_score = report.scores.process_score
        existing.pattern_score = report.scores.pattern_score
        existing.color_score = report.scores.color_score
        existing.culture_score = report.scores.culture_score
        existing.progress_score = report.scores.progress_score
        existing.deductions_json = [d.model_dump() for d in report.deductions]
        existing.master_feedback = report.master_feedback
        existing.next_task_recommendation = report.next_task_recommendation
    db.commit()

    return report
