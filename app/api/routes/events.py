"""Event API — POST /api/v1/events/check, GET /api/v1/events/pending, POST /api/v1/events/{event_id}/dismiss.

Design: event evaluation is triggered on-demand when the frontend polls.
The frontend sends the current game state each poll so the backend can
evaluate trigger conditions in real-time without needing a background loop.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.agent.master_agent import MasterAgent
from app.agent.prompts import EVENT_GENERATION_PROMPT, build_event_generation_prompt
from app.api.deps import get_agent
from app.data.schemas import GameEvent, GameStage, PendingEvent
from app.utils.logger import logger


router = APIRouter(prefix="/api/v1/events", tags=["events"])


# ---------------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------------


class EventCheckRequest(BaseModel):
    player_state: dict[str, Any]  # serialized PlayerState from frontend
    current_weather: str | None = None
    quest_step: int = -1
    arrived_location: str | None = None


class EventCheckResponse(BaseModel):
    fired: bool
    pending_events: list[dict]
    event_messages: list[str] = []  # lines from the fired AI event


class DismissRequest(BaseModel):
    player_id: str


class DismissResponse(BaseModel):
    ok: bool
    event_id: str


# ---------------------------------------------------------------------------
# In-memory pending events store (per-process, reset on restart)
# ---------------------------------------------------------------------------

_pending_events: list[dict] = []
_cooldown: dict[str, datetime] = {} # event_id → last fired at
_cooldown_window_minutes = 30 # don't show same event twice within 30 min


# ---------------------------------------------------------------------------
# Event template loading (lazy, cached)
# ---------------------------------------------------------------------------

_templates: list[dict] | None = None


def _load_templates() -> list[dict]:
    global _templates
    if _templates is not None:
        return _templates

    import json
    from pathlib import Path

    event_dir = Path(__file__).resolve().parent.parent.parent.parent / "data" / "events"
    _templates = []
    if not event_dir.is_dir():
        logger.warning("Event data dir not found: {}", event_dir)
        return _templates

    for path in event_dir.glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            items = data if isinstance(data, list) else [data]
            for item in items:
                _templates.append(item)
                logger.info("Loaded event template: {}", item.get("event_id"))
        except Exception as e:
            logger.error("Failed to load {}: {}", path, e)

    logger.info("Loaded {} event templates", len(_templates))
    return _templates


# ---------------------------------------------------------------------------
# Trigger evaluation helpers
# ---------------------------------------------------------------------------


def _in_cooldown(event_id: str) -> bool:
    last = _cooldown.get(event_id)
    if last is None:
        return False
    from datetime import timedelta

    return datetime.utcnow() - last < timedelta(minutes=_cooldown_window_minutes)


def _mark_fired(event_id: str) -> None:
    _cooldown[event_id] = datetime.utcnow()


def _eval_template(
    tmpl: dict,
    player_state: dict,
    current_weather: str | None,
    quest_step: int,
    arrived_location: str | None,
    game_start_time: datetime,
) -> bool:
    trigger_type = tmpl.get("trigger_type", "")
    conditions = tmpl.get("trigger_conditions", {})

    if _in_cooldown(tmpl["event_id"]):
        return False

    if trigger_type == "weather_change":
        wanted = conditions.get("weather")
        return wanted is not None and current_weather == wanted

    if trigger_type == "time_based":
        minutes_needed = conditions.get("minutes_since_start")
        if minutes_needed is not None:
            elapsed = (datetime.utcnow() - game_start_time).total_seconds() / 60.0
            return elapsed >= minutes_needed
        return False

    if trigger_type == "craft_risk":
        risk_tag = conditions.get("risk_tag")
        count_needed = conditions.get("count", 2)
        if not risk_tag:
            return False
        history = player_state.get("history", [])
        count = sum(1 for h in history if h.get("risk_tag") == risk_tag)
        return count >= count_needed

    if trigger_type == "quest_progress":
        target = conditions.get("target_location")
        return arrived_location is not None and target == arrived_location

    if trigger_type == "random":
        import random

        return random.random() < 0.2 # 20% chance per check

    return False


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/check", response_model=EventCheckResponse)
def check_events(
    body: EventCheckRequest,
    agent: MasterAgent = Depends(get_agent),
) -> EventCheckResponse:
    """Evaluate all event triggers against current game state and fire if eligible.

    This is the main endpoint the frontend calls every 30 seconds.
    """
    templates = _load_templates()
    if not templates:
        return EventCheckResponse(fired=False, pending_events=[])

    # Rehydrate PlayerState for the agent
    try:
        from app.data.schemas import PlayerState

        ps = PlayerState(**body.player_state)
    except Exception as e:
        logger.warning("Invalid player_state in event check: {}", e)
        ps = None

    # Use a fixed game-start time (first request) to compute elapsed minutes
    import time

    start_key = "_liangzuo_game_start"
    if not hasattr(check_events, start_key):
        setattr(check_events, start_key, datetime.utcnow())
    game_start = getattr(check_events, start_key)

    # Build the pending events list from templates that are in cooldown
    pending = []
    for tmpl in templates:
        if not _in_cooldown(tmpl["event_id"]):
            continue
        pending.append(
            PendingEvent(
                event_id=tmpl["event_id"],
                event_type=tmpl.get("event_type", ""),
                npc_id=tmpl.get("npc_id"),
                location=tmpl.get("location"),
                priority=tmpl.get("priority", 1),
                messages=tmpl.get("base_messages", []),
                effects=tmpl.get("effects", {}),
                created_at=datetime.utcnow(),
            ).model_dump()
        )

    if ps is None:
        return EventCheckResponse(fired=False, pending_events=[])

    # Evaluate which templates are eligible right now
    eligible = []
    for tmpl in templates:
        try:
            ok = _eval_template(
                tmpl,
                body.player_state,
                body.current_weather,
                body.quest_step,
                body.arrived_location,
                game_start,
            )
            if ok:
                eligible.append(tmpl)
        except Exception as e:
            logger.warning("Error evaluating template {}: {}", tmpl.get("event_id"), e)

    if not eligible:
        return EventCheckResponse(fired=False, pending_events=[])

    # Sort by priority
    eligible.sort(key=lambda t: t.get("priority", 0), reverse=True)
    chosen = eligible[0]

    # Ask the AI to generate dialogue for this event
    try:
        recent_risks = (
            [h.risk_tag for h in ps.history if h.risk_tag][-10:] if ps else []
        )
        user_content = build_event_generation_prompt(
            player_state=ps,
            candidate_events=eligible,
            current_weather=body.current_weather,
            recent_risk_tags=recent_risks,
        )
        messages = [
            {"role": "system", "content": EVENT_GENERATION_PROMPT},
            {"role": "user", "content": user_content},
        ]
        resp = agent.llm.chat(messages, temperature=0.8, max_tokens=300)
        content = resp.content or ""
    except Exception as e:
        logger.error("Event LLM call failed: {}", e)
        content = ""

    raw_lines = re.findall(r"「([^」]+)」", content)

    # Fallback to base_messages if LLM fails or returns nothing
    if not raw_lines or (len(raw_lines) == 1 and raw_lines[0] in ("不触发", "")):
        fallback = chosen.get("base_messages", [])
        if fallback:
            raw_lines = fallback
            logger.info("Event LLM fallback (placeholder key) → using base_messages")
        else:
            return EventCheckResponse(fired=False, pending_events=[])

    lines = raw_lines[:2]
    _mark_fired(chosen["event_id"])
    fired_event = PendingEvent(
        event_id=chosen["event_id"],
        event_type=chosen.get("event_type", ""),
        npc_id=chosen.get("npc_id"),
        location=chosen.get("location"),
        priority=chosen.get("priority", 1),
        messages=lines,
        effects=chosen.get("effects", {}),
        created_at=datetime.utcnow(),
    )
    _pending_events.insert(0, fired_event.model_dump())
    _pending_events[:] = _pending_events[:10]

    logger.info(
        "Event fired: {} → lines={}",
        chosen["event_id"],
        lines,
    )

    # One-shot: deliver the event once, then clear so it doesn't accumulate across sessions
    delivered = list(_pending_events)
    _pending_events.clear()

    return EventCheckResponse(
        fired=True,
        pending_events=delivered,
        event_messages=lines,
    )


@router.get("/pending", response_model=list[dict])
def get_pending_events() -> list[dict]:
    """Return all pending (fired but not yet dismissed) events."""
    return list(_pending_events)


@router.post("/{event_id}/dismiss", response_model=DismissResponse)
def dismiss_event(event_id: str) -> DismissResponse:
    """Dismiss a pending event so it stops showing."""
    for i, ev in enumerate(_pending_events):
        if ev["event_id"] == event_id:
            _pending_events.pop(i)
            return DismissResponse(ok=True, event_id=event_id)
    return DismissResponse(ok=False, event_id=event_id)


# ---------------------------------------------------------------------------
# State update endpoints (called by frontend to keep backend in sync)
# ---------------------------------------------------------------------------

_game_start: datetime | None = None


@router.post("/game/start")
def mark_game_start() -> dict[str, str]:
    """Mark the game start time (call once when player starts)."""
    global _game_start
    if _game_start is None:
        _game_start = datetime.utcnow()
    return {"status": "ok", "started_at": _game_start.isoformat()}


__all__ = ["router"]