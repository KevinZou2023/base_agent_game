"""Tests for the function-calling MasterAgent."""

from __future__ import annotations

import json
from typing import Any

import pytest

from app.agent.llm_client import ChatResponse, LLMClient, ToolCall
from app.agent.master_agent import MAX_TOOL_ITERATIONS, MasterAgent
from app.agent.tool_registry import Tool, ToolRegistry
from app.data.schemas import GameStage, LearnerLevel, PlayerState, XiangyunshaParameters


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------


class ScriptedLLM(LLMClient):
    """LLM that returns a fixed sequence of ChatResponses (queue-style)."""

    def __init__(self, responses: list[ChatResponse]) -> None:
        self._responses = list(responses)
        self.calls: list[dict[str, Any]] = []

    def chat(self, messages, **kwargs) -> ChatResponse:
        self.calls.append({"messages": list(messages), "kwargs": kwargs})
        if not self._responses:
            raise RuntimeError("ScriptedLLM ran out of canned responses")
        return self._responses.pop(0)


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


def _empty_registry() -> ToolRegistry:
    """Registry that registers no tools — useful when we want the LLM to give
    a direct reply with nothing to call."""
    return ToolRegistry()


def _mock_registry_with_search(returned: dict) -> ToolRegistry:
    reg = ToolRegistry()
    reg.register(Tool(
        name="knowledge_search",
        description="mock search",
        parameters_schema={"type": "object", "properties": {"query": {"type": "string"}}},
        handler=lambda **kw: returned,
    ))
    return reg


# ---------------------------------------------------------------------------
# Deterministic guardrail
# ---------------------------------------------------------------------------


def test_rules_run_regardless_of_llm_behaviour():
    """Even if the LLM tries to give a misleading reply, rule_result is still
    computed and exposed in the AgentResponse."""

    llm = ScriptedLLM([ChatResponse(content="一切正常！继续做下去。")])
    agent = MasterAgent(llm=llm, registry=_empty_registry())

    state = _ideal_state()
    response = agent.respond(
        state,
        operation_event={"type": "param_change", "changes": {"wu_duration_minutes": 130.0}},
    )

    # The LLM said "一切正常", but the rules still caught wu_too_long
    assert "wu_too_long" in response.risk_tags
    assert response.recommended_actions
    # The reply text comes from the LLM verbatim (we don't override it)
    assert response.master_reply == "一切正常！继续做下去。"


def test_initial_user_message_includes_rule_result():
    """The LLM must SEE the rule findings in the user message so it can't ignore them."""

    llm = ScriptedLLM([ChatResponse(content="OK")])
    agent = MasterAgent(llm=llm, registry=_empty_registry())

    state = _ideal_state()
    agent.respond(
        state,
        operation_event={"type": "param_change", "changes": {"wu_duration_minutes": 130.0}},
    )

    first_call = llm.calls[0]
    user_msg = first_call["messages"][1]["content"]
    assert "wu_too_long" in user_msg
    assert "规则检测结果" in user_msg


# ---------------------------------------------------------------------------
# Agent loop — function calling
# ---------------------------------------------------------------------------


def test_agent_loop_executes_tool_call_then_finalizes():
    """LLM emits tool_calls in turn 1, then a final reply in turn 2."""

    tool_call = ToolCall(id="c1", name="knowledge_search", arguments={"query": "过乌时间"})
    llm = ScriptedLLM([
        ChatResponse(tool_calls=[tool_call]),                 # turn 1: ask to search
        ChatResponse(content="过乌时间一般 60-90 分钟。"),       # turn 2: final reply
    ])
    reg = _mock_registry_with_search({"hits": [{"document": "过乌 60-90 分钟"}]})
    agent = MasterAgent(llm=llm, registry=reg)

    response = agent.respond(_ideal_state(), message="过乌多久合适？")

    # Two LLM calls and one tool execution
    assert len(llm.calls) == 2
    # Final reply came from turn 2
    assert response.master_reply == "过乌时间一般 60-90 分钟。"
    # The debug trace should record the tool call
    tool_calls_debug = response.debug["tool_calls"]
    assert len(tool_calls_debug) == 1
    assert tool_calls_debug[0]["name"] == "knowledge_search"
    assert tool_calls_debug[0]["arguments"] == {"query": "过乌时间"}


def test_agent_can_answer_without_calling_any_tools():
    """When LLM decides no tool is needed, it just returns content."""

    llm = ScriptedLLM([ChatResponse(content="嗯，做得稳，继续。")])
    agent = MasterAgent(llm=llm, registry=_empty_registry())

    response = agent.respond(_ideal_state())
    assert response.master_reply == "嗯，做得稳，继续。"
    assert response.debug["tool_calls"] == []
    assert len(llm.calls) == 1


def test_agent_respects_max_iterations():
    """If the LLM keeps asking for tool calls, we bail out and use fallback."""

    looping_tool_call = ToolCall(id="c", name="knowledge_search", arguments={"query": "x"})
    # Always emit a tool call, never finalize
    llm = ScriptedLLM([
        ChatResponse(tool_calls=[looping_tool_call]) for _ in range(MAX_TOOL_ITERATIONS + 5)
    ])
    reg = _mock_registry_with_search({"hits": []})
    agent = MasterAgent(llm=llm, registry=reg, max_iterations=3)

    response = agent.respond(_ideal_state())
    # Hit cap → fallback reply
    assert response.master_reply  # non-empty fallback
    # Should have stopped at max_iterations
    assert len(llm.calls) == 3


def test_unknown_tool_returns_structured_error_to_llm():
    """If the LLM hallucinates a tool name, the registry returns an error
    string that the LLM can read and self-correct from."""

    bad_call = ToolCall(id="c1", name="nonexistent_tool", arguments={"x": 1})
    llm = ScriptedLLM([
        ChatResponse(tool_calls=[bad_call]),
        ChatResponse(content="抱歉，让我重新答。"),
    ])
    agent = MasterAgent(llm=llm, registry=_empty_registry())

    response = agent.respond(_ideal_state())
    # Second LLM call should have seen the error in a tool message
    assert len(llm.calls) == 2
    tool_msgs = [m for m in llm.calls[1]["messages"] if m.get("role") == "tool"]
    assert tool_msgs
    assert "unknown tool" in tool_msgs[0]["content"]
    # Final reply still came through
    assert response.master_reply == "抱歉，让我重新答。"


def test_llm_failure_falls_back_to_deterministic_text():
    class FailingLLM(LLMClient):
        def chat(self, *a, **kw):
            raise RuntimeError("simulated outage")

    agent = MasterAgent(llm=FailingLLM(), registry=_empty_registry())
    state = _ideal_state()
    response = agent.respond(
        state,
        operation_event={"type": "param_change", "changes": {"wu_duration_minutes": 130.0}},
    )
    # Fallback reply references the rule's cause/correction
    assert response.master_reply
    assert "wu_too_long" in response.risk_tags


# ---------------------------------------------------------------------------
# State / history updates
# ---------------------------------------------------------------------------


def test_history_updated_on_risk_regardless_of_tool_usage():
    llm = ScriptedLLM([ChatResponse(content="收到")])
    agent = MasterAgent(llm=llm, registry=_empty_registry())

    state = _ideal_state()
    assert state.history == []
    agent.respond(
        state,
        operation_event={"type": "param_change", "changes": {"wash_water_temp": 45.0}},
    )
    assert len(state.history) == 1
    assert state.history[0].risk_tag == "wash_temp_too_high"


def test_operation_summary_appears_in_response():
    llm = ScriptedLLM([ChatResponse(content="OK")])
    agent = MasterAgent(llm=llm, registry=_empty_registry())
    response = agent.respond(
        _ideal_state(),
        operation_event={"type": "param_change", "changes": {"wu_duration_minutes": 130.0}},
    )
    assert "过乌时间=130.0分钟" in response.operation_summary
