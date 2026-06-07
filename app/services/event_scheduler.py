"""EventScheduler — background asyncio loop that evaluates trigger conditions and fires AI-generated events."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from app.agent.master_agent import MasterAgent
from app.data.schemas import GameEvent, GameStage, PendingEvent, PlayerState
from app.utils.logger import logger


EVENT_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "events"
TICK_INTERVAL_SECONDS = 60  # evaluate every 60 seconds
PLAYER_START_KEY = "liangzuo.game_start"


class EventScheduler:
    """Background event scheduler.

    Lives as a singleton. Call `start()` from the FastAPI lifespan to start the
    background loop; call `stop()` on shutdown.
    """

    def __init__(self, agent: MasterAgent) -> None:
        self.agent = agent
        self._running = False
        self._task: asyncio.Task | None = None
        self._pending_events: list[PendingEvent] = []
        self._cooldown: dict[str, datetime] = {}  # event_id → last fired at
        self._templates: list[GameEvent] = []
        self._player_start: datetime | None = None

    # ------------------------------------------------------------------
    # Templates loading
    # ------------------------------------------------------------------

    def _load_templates(self) -> None:
        """Load all event templates from data/events/*.json."""
        self._templates.clear()
        if not EVENT_DATA_DIR.is_dir():
            logger.warning("Event data directory not found: {}", EVENT_DATA_DIR)
            return
        for path in EVENT_DATA_DIR.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                # Support both a single dict and a list of dicts
                items = data if isinstance(data, list) else [data]
                for item in items:
                    ev = GameEvent(**item)
                    self._templates.append(ev)
                    logger.info("Loaded event template: {}", ev.event_id)
            except Exception as e:
                logger.error("Failed to load {}: {}", path, e)
        logger.info("EventScheduler loaded {} templates", len(self._templates))

    # ------------------------------------------------------------------
    # Trigger evaluation
    # ------------------------------------------------------------------

    def _eval_time_based(self, ev: GameEvent, elapsed_minutes: float) -> bool:
        minutes = ev.trigger_conditions.get("minutes_since_start")
        if minutes is not None and elapsed_minutes >= minutes:
            return True
        # RANDOM trigger: every tick has a small chance
        if ev.trigger_type.value == "random":
            import random

            return random.random() < 0.3  # 30% chance per tick
        return False

    def _eval_weather(self, ev: GameEvent, current_weather: str | None) -> bool:
        wanted = ev.trigger_conditions.get("weather")
        if wanted and current_weather == wanted:
            return True
        return False

    def _eval_craft_risk(self, ev: GameEvent, player_state: PlayerState) -> bool:
        risk_tag = ev.trigger_conditions.get("risk_tag")
        count_needed = ev.trigger_conditions.get("count", 2)
        if not risk_tag:
            return False
        count = sum(1 for h in player_state.history if h.risk_tag == risk_tag)
        return count >= count_needed

    def _eval_quest(self, ev: GameEvent, quest_step: int) -> bool:
        target = ev.trigger_conditions.get("target_location")
        # quest_step starts at 0; when player is at step N, they're heading to GOLDEN_PATH[N].targetLoc
        if not target:
            return False
        # We'll store the last arrived location in player_state.task_theme temporarily
        return False # resolved dynamically in _eval_quest_progress

    def _check_cooldown(self, ev: GameEvent) -> bool:
        """Return True if this event is still in cooldown."""
        if ev.cooldown_minutes is None:
            return False
        last = self._cooldown.get(ev.event_id)
        if last is None:
            return False
        elapsed = datetime.utcnow() - last
        return elapsed < timedelta(minutes=ev.cooldown_minutes)

    def evaluate(
        self,
        player_state: PlayerState,
        current_weather: str | None,
        quest_step: int,
        arrived_location: str | None,
    ) -> list[GameEvent]:
        """Return all event templates that are currently eligible to fire."""

        if not self._templates:
            self._load_templates()

        # Compute elapsed time since game start
        elapsed_minutes = 0.0
        if self._player_start:
            elapsed_minutes = (datetime.utcnow() - self._player_start).total_seconds() / 60.0

        eligible: list[GameEvent] = []
        for ev in self._templates:
            if self._check_cooldown(ev):
                continue

            ok = False
            if ev.trigger_type.value == "time_based":
                ok = self._eval_time_based(ev, elapsed_minutes)
            elif ev.trigger_type.value == "weather_change":
                ok = self._eval_weather(ev, current_weather)
            elif ev.trigger_type.value == "craft_risk":
                ok = self._eval_craft_risk(ev, player_state)
            elif ev.trigger_type.value == "quest_progress":
                target = ev.trigger_conditions.get("target_location")
                ok = arrived_location is not None and target == arrived_location
            elif ev.trigger_type.value == "random":
                ok = self._eval_time_based(ev, elapsed_minutes)

            if ok:
                eligible.append(ev)

        # Sort by priority (higher first)
        eligible.sort(key=lambda e: e.priority, reverse=True)
        return eligible

    # ------------------------------------------------------------------
    # Event firing
    # ------------------------------------------------------------------

    def _record_fired(self, ev: GameEvent) -> None:
        self._cooldown[ev.event_id] = datetime.utcnow()

    def fire_event(
        self,
        player_state: PlayerState,
        candidate_events: list[GameEvent],
        current_weather: str | None,
    ) -> PendingEvent | None:
        """Ask the AI to pick the best event and generate its dialogue."""

        candidate_dicts = [ev.model_dump() for ev in candidate_events]
        resp = self.agent.generate_event(
            player_state=player_state,
            candidate_events=candidate_dicts,
            current_weather=current_weather,
        )

        raw = resp.debug.get("raw_llm_response", "")
        if "不触发" in raw or not resp.master_reply:
            return None

        # Extract lines from 「」format
        import re

        lines = re.findall(r"「([^」]+)」", resp.master_reply)
        if not lines:
            return None

        # Use the highest-priority candidate as the template
        template = candidate_events[0]
        self._record_fired(template)

        pending = PendingEvent(
            event_id=template.event_id,
            event_type=template.event_type,
            npc_id=template.npc_id,
            location=template.location,
            priority=template.priority,
            messages=lines,
            effects=template.effects,
            created_at=datetime.utcnow(),
        )
        self._pending_events.insert(0, pending)
        # Keep at most 10 pending events
        self._pending_events = self._pending_events[:10]
        logger.info("EventScheduler fired event: {} → {}", template.event_id, lines)
        return pending

    # ------------------------------------------------------------------
    # Pending event API (called by the events route)
    # ------------------------------------------------------------------

    def get_pending(self, player_id: str) -> list[PendingEvent]:
        """Return pending events for a player, clearing older ones."""
        # For now, return all pending (no per-player separation in this demo)
        return list(self._pending_events)

    def dismiss(self, event_id: str) -> bool:
        """Remove a specific pending event."""
        for i, ev in enumerate(self._pending_events):
            if ev.event_id == event_id:
                self._pending_events.pop(i)
                return True
        return False

    # ------------------------------------------------------------------
    # Background loop
    # ------------------------------------------------------------------

    async def start(
        self,
        player_state_getter: callable,
        weather_getter: callable,
        quest_step_getter: callable,
        arrived_location_getter: callable,
    ) -> None:
        """Start the background scheduler loop.

        The getter callables are called each tick to get the current game state.
        """
        self._running = True
        self._player_start = datetime.utcnow()
        self._load_templates()
        logger.info("EventScheduler started (tick every {}s)", TICK_INTERVAL_SECONDS)

        while self._running:
            try:
                player_state = player_state_getter()
                weather = weather_getter()
                quest_step = quest_step_getter()
                arrived = arrived_location_getter()

                eligible = self.evaluate(player_state, weather, quest_step, arrived)
                if eligible:
                    self.fire_event(player_state, eligible, weather)
            except Exception as e:
                logger.exception("EventScheduler tick error: {}", e)

            await asyncio.sleep(TICK_INTERVAL_SECONDS)

    def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
        logger.info("EventScheduler stopped")


__all__ = ["EventScheduler"]