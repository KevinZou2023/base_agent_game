"""teaching_strategy_tool — decide how strongly the master should intervene.

Pure rule-based decision (no LLM). The master is told *what kind* of reply to
generate (explicit hint / probing question / hard warning / silent encouragement),
and the LLM only handles wording.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.data.schemas import (
    LearnerLevel,
    PlayerState,
    RiskSeverity,
    RuleCheckResult,
)


class HintType(str, Enum):
    """How directly the master should guide the player this turn."""

    EXPLICIT = "explicit"     # tell exactly what to fix
    PROBE = "probe"           # ask leading questions instead of telling
    WARN = "warn"             # stop them: this will ruin the piece
    ENCOURAGE = "encourage"   # acknowledge, low-information
    SILENT = "silent"         # canned line, do not call LLM


@dataclass(frozen=True)
class StrategyDecision:
    hint_type: HintType
    intervention_level: int  # 0..3 — how much detail the master gives
    tone: str                # e.g. "warm", "stern", "neutral"
    skip_llm: bool = False


def decide_teaching(
    player_state: PlayerState,
    rule_result: RuleCheckResult,
) -> StrategyDecision:
    """Return how the master should respond this turn."""

    severity = rule_result.overall_severity
    level = player_state.learner_level

    # 1) High-severity risk → hard stop, regardless of learner level
    if severity == RiskSeverity.HIGH:
        return StrategyDecision(
            hint_type=HintType.WARN,
            intervention_level=3,
            tone="stern",
        )

    # 2) Medium-severity:
    #    Beginner gets an explicit hint; intermediate+ gets a probing question.
    if severity == RiskSeverity.MEDIUM:
        if level == LearnerLevel.BEGINNER:
            return StrategyDecision(
                hint_type=HintType.EXPLICIT,
                intervention_level=2,
                tone="warm",
            )
        return StrategyDecision(
            hint_type=HintType.PROBE,
            intervention_level=2,
            tone="neutral",
        )

    # 3) Low-severity but with risks:
    if rule_result.risks:
        return StrategyDecision(
            hint_type=HintType.EXPLICIT if level == LearnerLevel.BEGINNER else HintType.PROBE,
            intervention_level=1,
            tone="warm",
        )

    # 4) No risk — encourage and stay out of the way.
    #    For beginners, still acknowledge (LLM, short). For advanced, canned line.
    if level == LearnerLevel.BEGINNER:
        return StrategyDecision(
            hint_type=HintType.ENCOURAGE,
            intervention_level=1,
            tone="warm",
        )
    return StrategyDecision(
        hint_type=HintType.SILENT,
        intervention_level=0,
        tone="neutral",
        skip_llm=True,
    )


__all__ = ["HintType", "StrategyDecision", "decide_teaching"]
