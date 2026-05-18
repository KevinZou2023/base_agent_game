"""LLM-callable wrapper around the teaching-strategy decision.

The underlying `decide_teaching(player_state, rule_result)` takes rich Pydantic
objects and is used by the Agent infrastructure directly. This wrapper exposes
a flat, JSON-friendly signature the LLM can pass via function calling.
"""

from __future__ import annotations

from typing import Any

from app.data.schemas import (
    LearnerLevel,
    PlayerState,
    RiskFinding,
    RiskSeverity,
    RuleCheckResult,
    XiangyunshaParameters,
)
from app.tools.teaching_strategy import StrategyDecision, decide_teaching


def teaching_strategy_tool(
    learner_level: str,
    severity: str,
    risk_count: int = 0,
) -> dict[str, Any]:
    """Decide the master's intervention level given the situation.

    Returns: {hint_type, intervention_level, tone, skip_llm}
    """

    try:
        level_enum = LearnerLevel(learner_level)
    except ValueError:
        level_enum = LearnerLevel.BEGINNER

    try:
        sev_enum = RiskSeverity(severity)
    except ValueError:
        sev_enum = RiskSeverity.LOW

    # Build a minimal fake RuleCheckResult so we can reuse decide_teaching as-is
    findings: list[RiskFinding] = []
    if risk_count > 0:
        findings = [
            RiskFinding(
                risk_tag="placeholder",
                cause="",
                correction="",
                severity=sev_enum,
            )
            for _ in range(risk_count)
        ]
    fake_result = RuleCheckResult(
        risks=findings,
        overall_severity=sev_enum,
        passed=(sev_enum == RiskSeverity.LOW and risk_count == 0),
    )
    fake_state = PlayerState(player_id="_strategy_query", learner_level=level_enum)
    decision: StrategyDecision = decide_teaching(fake_state, fake_result)

    return {
        "hint_type": decision.hint_type.value,
        "intervention_level": decision.intervention_level,
        "tone": decision.tone,
        "skip_llm": decision.skip_llm,
    }


__all__ = ["teaching_strategy_tool"]
