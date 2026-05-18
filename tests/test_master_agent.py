"""Tests for the MasterAgent orchestration. LLM is mocked so these tests are deterministic and fast."""

from __future__ import annotations

from app.agent.llm_client import LLMClient
from app.agent.master_agent import MasterAgent
from app.data.schemas import GameStage, LearnerLevel, PlayerState, XiangyunshaParameters


class MockLLM(LLMClient):
    """Echoes back a tag that lets us assert the LLM was called."""

    def __init__(self) -> None:
        self.calls: list[dict] = []

    def chat(self, messages, **kwargs):
        self.calls.append({"messages": messages, "kwargs": kwargs})
        return "MOCK_MASTER_REPLY"


def _ideal_state(level: LearnerLevel = LearnerLevel.BEGINNER) -> PlayerState:
    return PlayerState(
        player_id="t",
        learner_level=level,
        current_stage=GameStage.PARAMETER,
        parameters=XiangyunshaParameters(
            shuliang_concentration=0.6,
            dye_cycles=10,
            dye_water_temp=28.0,
            sun_hours=6.0,
            sun_total_days=4,
            wu_mud_thickness=0.55,
            wu_duration_minutes=75.0,
            wu_apply_count=2,
            wash_water_temp=25.0,
            air_dry_hours=8.0,
        ),
    )


def test_silent_strategy_skips_llm():
    llm = MockLLM()
    agent = MasterAgent(llm=llm, use_vector_search=False)
    response = agent.respond(_ideal_state(LearnerLevel.INTERMEDIATE))
    assert response.hint_type == "silent"
    assert llm.calls == [], "LLM should not be called in silent strategy"
    assert response.master_reply != "MOCK_MASTER_REPLY"


def test_encourage_calls_llm_for_beginner():
    llm = MockLLM()
    agent = MasterAgent(llm=llm, use_vector_search=False)
    response = agent.respond(_ideal_state(LearnerLevel.BEGINNER))
    # Beginner without risk → encourage → LLM call OR canned encouragement
    assert response.hint_type == "encourage"


def test_warn_strategy_calls_llm():
    llm = MockLLM()
    agent = MasterAgent(llm=llm, use_vector_search=False)
    state = _ideal_state()
    state.parameters.dye_cycles = 3
    response = agent.respond(
        state,
        operation_event={"type": "param_change", "changes": {"wu_apply_count": 1}},
    )
    assert response.hint_type == "warn"
    assert response.master_reply == "MOCK_MASTER_REPLY"
    assert len(llm.calls) == 1
    # Verify system + user messages were assembled
    messages = llm.calls[0]["messages"]
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"
    assert "wu_before_dye" in messages[1]["content"] or "dye_cycles_insufficient" in messages[1]["content"]


def test_risks_propagate_to_response():
    agent = MasterAgent(llm=MockLLM(), use_vector_search=False)
    state = _ideal_state()
    response = agent.respond(
        state,
        operation_event={"type": "param_change", "changes": {"wash_water_temp": 45.0}},
    )
    assert "wash_temp_too_high" in response.risk_tags
    assert response.recommended_actions  # non-empty


def test_history_updated_on_risk():
    agent = MasterAgent(llm=MockLLM(), use_vector_search=False)
    state = _ideal_state()
    assert state.history == []
    agent.respond(
        state,
        operation_event={"type": "param_change", "changes": {"wash_water_temp": 45.0}},
    )
    assert len(state.history) == 1
    assert state.history[0].risk_tag == "wash_temp_too_high"


def test_llm_failure_falls_back_to_deterministic_text():
    class FailingLLM(LLMClient):
        def chat(self, *a, **kw):
            raise RuntimeError("simulated LLM outage")

    agent = MasterAgent(llm=FailingLLM(), use_vector_search=False)
    state = _ideal_state()
    response = agent.respond(
        state,
        operation_event={"type": "param_change", "changes": {"wu_duration_minutes": 130.0}},
    )
    # Should still return a usable reply
    assert response.master_reply
    assert "wu_too_long" in response.risk_tags


def test_operation_summary_in_response():
    agent = MasterAgent(llm=MockLLM(), use_vector_search=False)
    response = agent.respond(
        _ideal_state(),
        operation_event={"type": "param_change", "changes": {"wu_duration_minutes": 130.0}},
    )
    assert "过乌时间=130.0分钟" in response.operation_summary
