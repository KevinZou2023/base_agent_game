"""Tests for the operation perception tool."""

from __future__ import annotations

from app.data.schemas import GameStage, PlayerState, XiangyunshaParameters
from app.tools.operation_perception import (
    OperationEvent,
    apply_event_to_parameters,
    perceive,
)


def _state(**overrides) -> PlayerState:
    return PlayerState(
        player_id="t",
        current_stage=GameStage.PARAMETER,
        parameters=XiangyunshaParameters(**overrides) if overrides else XiangyunshaParameters(),
    )


def test_idle_event_when_no_payload():
    ev = perceive(_state(), None)
    assert ev.event_type == "idle"
    assert ev.changed_parameters == {}


def test_param_change_infers_stage_and_summary():
    ev = perceive(_state(), {"type": "param_change", "changes": {"wu_duration_minutes": 130.0}})
    assert ev.event_type == "param_change"
    assert ev.changed_parameters == {"wu_duration_minutes": 130.0}
    assert "过乌时间=130.0分钟" in ev.summary()


def test_material_select():
    ev = perceive(_state(), {"type": "material_select", "material_id": "white_silk_plain"})
    assert ev.event_type == "material_select"
    assert ev.stage == GameStage.MATERIAL
    assert "选择了材料" in ev.summary()


def test_submit():
    ev = perceive(_state(), {"type": "submit"})
    assert ev.event_type == "submit"
    assert ev.stage == GameStage.PRE_GENERATE
    assert ev.summary() == "确认生成作品"


def test_apply_event_creates_new_parameters_object():
    state = _state()
    original_temp = state.parameters.dye_water_temp
    ev = OperationEvent(
        event_type="param_change",
        stage=GameStage.PARAMETER,
        changed_parameters={"dye_water_temp": 60.0},
        raw={},
    )
    new_params = apply_event_to_parameters(state.parameters, ev)
    assert new_params.dye_water_temp == 60.0
    # Original unchanged
    assert state.parameters.dye_water_temp == original_temp


def test_apply_event_ignores_unknown_field():
    state = _state()
    ev = OperationEvent(
        event_type="param_change",
        stage=GameStage.PARAMETER,
        changed_parameters={"not_a_param": 42},
        raw={},
    )
    new_params = apply_event_to_parameters(state.parameters, ev)
    # Should be unchanged
    assert new_params.model_dump() == state.parameters.model_dump()
