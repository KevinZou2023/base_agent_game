"""process_rule_tool — runtime wrapper around the rule engine."""

from __future__ import annotations

from app.data.rules import evaluate
from app.data.schemas import RuleCheckResult, XiangyunshaParameters


def process_rule(parameters: XiangyunshaParameters) -> RuleCheckResult:
    """Run all Xiangyunsha craft rules over the player's current parameters.

    Returns a structured RuleCheckResult. Pure deterministic Python — no LLM.
    """
    return evaluate(parameters)


__all__ = ["process_rule"]
