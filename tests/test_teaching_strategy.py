"""Tests for the teaching strategy decision tool."""

from __future__ import annotations

from app.data.rules import evaluate
from app.data.schemas import LearnerLevel, PlayerState, RiskSeverity, XiangyunshaParameters
from app.tools.teaching_strategy import HintType, decide_teaching


def _state(level: LearnerLevel, **param_overrides) -> PlayerState:
    base = XiangyunshaParameters().model_dump()
    base.update({
        "shuliang_concentration": 0.6,
        "dye_cycles": 10,
        "dye_water_temp": 28.0,
        "sun_hours": 6.0,
        "sun_total_days": 4,
        "wu_mud_thickness": 0.55,
        "wu_duration_minutes": 75.0,
        "wu_apply_count": 2,
        "wash_water_temp": 25.0,
        "air_dry_hours": 8.0,
    })
    base.update(param_overrides)
    return PlayerState(
        player_id="t",
        learner_level=level,
        parameters=XiangyunshaParameters(**base),
    )


def test_high_severity_triggers_warn():
    state = _state(LearnerLevel.BEGINNER, dye_cycles=3, wu_apply_count=1)
    decision = decide_teaching(state, evaluate(state.parameters))
    assert decision.hint_type == HintType.WARN
    assert decision.intervention_level == 3


def test_medium_severity_beginner_gets_explicit():
    state = _state(LearnerLevel.BEGINNER, wu_duration_minutes=130.0)
    decision = decide_teaching(state, evaluate(state.parameters))
    assert decision.hint_type == HintType.EXPLICIT


def test_medium_severity_intermediate_gets_probe():
    state = _state(LearnerLevel.INTERMEDIATE, wu_duration_minutes=130.0)
    decision = decide_teaching(state, evaluate(state.parameters))
    assert decision.hint_type == HintType.PROBE


def test_no_risk_beginner_gets_encouragement():
    state = _state(LearnerLevel.BEGINNER)
    decision = decide_teaching(state, evaluate(state.parameters))
    assert decision.hint_type == HintType.ENCOURAGE
    assert decision.skip_llm is False


def test_no_risk_intermediate_is_silent_no_llm():
    state = _state(LearnerLevel.INTERMEDIATE)
    decision = decide_teaching(state, evaluate(state.parameters))
    assert decision.hint_type == HintType.SILENT
    assert decision.skip_llm is True
