"""scoring_tool — multi-dimensional artwork scoring (Week 1 skeleton).

Full implementation lands in Week 4. For Week 1 this provides a rule-based
deduction skeleton so the rest of the system has a stable type to depend on.

5 dimensions per the spec:
  - process_score   工艺合理性
  - pattern_score   纹样完成度
  - color_score     色彩协调度 (黑亮面 / 红褐底色)
  - culture_score   文化表达度
  - progress_score  学习进步度
"""

from __future__ import annotations

from app.data.rules import evaluate as evaluate_rules
from app.data.schemas import (
    Deduction,
    RiskFinding,
    RiskSeverity,
    ScoreBreakdown,
    ScoringReport,
    XiangyunshaParameters,
)


# Deduction points per severity (Week 1 baseline; tunable later).
SEVERITY_POINTS: dict[RiskSeverity, float] = {
    RiskSeverity.LOW: 3.0,
    RiskSeverity.MEDIUM: 7.0,
    RiskSeverity.HIGH: 15.0,
}

# Map each risk tag → which dimension it primarily hurts.
RISK_DIMENSION_MAP: dict[str, str] = {
    "base_color_too_light": "color_score",
    "dye_cycles_insufficient": "process_score",
    "dye_temp_too_high": "process_score",
    "dye_temp_too_low": "process_score",
    "sun_dry_insufficient": "process_score",
    "wu_before_dye": "process_score",
    "wu_uneven": "pattern_score",
    "wu_too_short": "color_score",
    "wu_too_long": "color_score",
    "gloss_insufficient": "color_score",
    "wu_apply_excessive": "pattern_score",
    "wash_temp_too_high": "color_score",
    "air_dry_insufficient": "process_score",
}

BASE_SCORE = 90.0


def score_artwork(
    artwork_id: str,
    parameters: XiangyunshaParameters,
    previous_risks: list[str] | None = None,
) -> ScoringReport:
    """Compute the 5-dimension score for an artwork.

    Week 1 logic: start every dimension at BASE_SCORE, subtract per rule violation.
    Week 4 will plug in image-based pattern/color analysis on top of this.
    """

    rule_result = evaluate_rules(parameters)
    breakdown = ScoreBreakdown(
        process_score=BASE_SCORE,
        pattern_score=BASE_SCORE,
        color_score=BASE_SCORE,
        culture_score=BASE_SCORE,
        progress_score=BASE_SCORE,
    )
    deductions: list[Deduction] = []

    for risk in rule_result.risks:
        dim = RISK_DIMENSION_MAP.get(risk.risk_tag, "process_score")
        pts = SEVERITY_POINTS[risk.severity]
        current = getattr(breakdown, dim)
        setattr(breakdown, dim, max(0.0, current - pts))
        deductions.append(
            Deduction(
                dimension=dim,
                points=pts,
                reason=risk.cause,
                risk_tag=risk.risk_tag,
            )
        )

    # Progress score: small bonus if previous identical risks no longer appear
    if previous_risks:
        current_tags = {r.risk_tag for r in rule_result.risks}
        resolved = set(previous_risks) - current_tags
        bonus = min(10.0, 3.0 * len(resolved))
        breakdown.progress_score = min(100.0, breakdown.progress_score + bonus)

    return ScoringReport(
        artwork_id=artwork_id,
        scores=breakdown,
        deductions=deductions,
        master_feedback="",  # filled in Week 4 by teaching_feedback_tool
        next_task_recommendation=None,
    )


__all__ = ["score_artwork"]
