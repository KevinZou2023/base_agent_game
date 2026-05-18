"""POST /api/v1/artwork/generate — generate Xiangyunsha texture artwork."""

from __future__ import annotations

import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.data.rules import evaluate
from app.data.schemas import ArtworkGenerateRequest, ArtworkGenerateResponse
from app.storage.db import Artwork, User
from app.storage.file_store import save_remote_image
from app.tools.image_generation import ImageGenerationError, generate_image
from app.tools.texture_prompt import build_texture_prompt
from app.utils.logger import logger


router = APIRouter(prefix="/api/v1/artwork", tags=["artwork"])


@router.post(
    "/generate",
    response_model=ArtworkGenerateResponse,
    summary="触发 AI 生成作品贴图",
    description=(
        "根据玩家参数构造通义万相 prompt，生成扎染风格贴图，下载到本地后返回静态 URL。"
        "贴图反映**参数对应的实际工艺效果**（参数错误时生成的贴图也会有相应缺陷）。"
        "调用耗时约 30–60 秒。"
    ),
)
def generate_artwork(
    body: ArtworkGenerateRequest,
    db: Session = Depends(get_db),
) -> ArtworkGenerateResponse:
    # ---- 1) Resolve user (auto-create if missing) ----
    user = db.get(User, body.player_id)
    if user is None:
        user = User(player_id=body.player_id)
        db.add(user)
        db.flush()

    # ---- 2) Run rule check so we capture risk_tags at generation time ----
    rule_result = evaluate(body.parameters)

    # ---- 3) Build prompt ----
    prompt_result = build_texture_prompt(
        body.parameters,
        task_theme=body.task_theme,
        target_pattern=body.target_pattern,
    )

    # ---- 4) Persist the pending artwork row first (so failures still leave a record) ----
    artwork_id = f"art_{uuid.uuid4().hex[:10]}"
    artwork = Artwork(
        artwork_id=artwork_id,
        player_id=body.player_id,
        task_theme=body.task_theme,
        parameters_json=body.parameters.model_dump(),
        prompt_used=prompt_result.prompt,
        status="pending",
    )
    db.add(artwork)
    db.commit()

    # ---- 5) Call 通义万相 + download ----
    try:
        gen = generate_image(
            prompt=prompt_result.prompt,
            negative_prompt=prompt_result.negative_prompt,
        )
        stored = save_remote_image(artwork_id, gen.image_url)
    except ImageGenerationError as e:
        artwork.status = "failed"
        db.commit()
        raise HTTPException(status_code=502, detail=f"image generation failed: {e}")
    except Exception as e:
        artwork.status = "failed"
        db.commit()
        logger.exception("Artwork generation crashed: {}", e)
        raise HTTPException(status_code=500, detail=f"artwork pipeline error: {e}")

    # ---- 6) Update artwork with final URL ----
    artwork.image_path = str(stored.local_path)
    artwork.image_url = stored.static_url
    artwork.status = "done"
    db.commit()

    return ArtworkGenerateResponse(
        artwork_id=artwork_id,
        image_url=stored.static_url,
        original_image_url=gen.image_url,
        prompt_used=prompt_result.prompt,
        negative_prompt=prompt_result.negative_prompt,
        style_tags=prompt_result.style_tags,
        quality_hint=prompt_result.quality_hint,
        status="done",
        parameters=body.parameters,
        rule_check_passed=rule_result.passed,
        risk_tags=[r.risk_tag for r in rule_result.risks],
        created_at=artwork.created_at or datetime.utcnow(),
    )
