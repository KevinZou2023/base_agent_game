"""Tests for the ToolRegistry."""

from __future__ import annotations

import json

import pytest

from app.agent.tool_registry import Tool, ToolRegistry, build_default_registry


def test_register_and_execute_basic_tool():
    reg = ToolRegistry()
    reg.register(Tool(
        name="add",
        description="add two numbers",
        parameters_schema={
            "type": "object",
            "properties": {"a": {"type": "integer"}, "b": {"type": "integer"}},
            "required": ["a", "b"],
        },
        handler=lambda a, b: a + b,
    ))
    assert reg.execute("add", {"a": 2, "b": 3}) == 5


def test_unknown_tool_returns_error_dict():
    reg = ToolRegistry()
    result = reg.execute("ghost", {})
    assert "error" in result
    assert "unknown tool" in result["error"]


def test_bad_arguments_return_structured_error():
    reg = ToolRegistry()
    reg.register(Tool(
        name="needs_x",
        description="",
        parameters_schema={"type": "object"},
        handler=lambda x: x,
    ))
    result = reg.execute("needs_x", {"y": 1})
    assert "error" in result
    assert "bad arguments" in result["error"]


def test_schemas_emit_openai_format():
    reg = ToolRegistry()
    reg.register(Tool(
        name="foo",
        description="bar",
        parameters_schema={"type": "object", "properties": {}},
        handler=lambda: None,
    ))
    schemas = reg.schemas()
    assert len(schemas) == 1
    assert schemas[0]["type"] == "function"
    assert schemas[0]["function"]["name"] == "foo"
    assert schemas[0]["function"]["description"] == "bar"
    assert schemas[0]["function"]["parameters"] == {"type": "object", "properties": {}}


def test_serialize_pydantic_result():
    from app.data.schemas import RiskFinding, RiskSeverity

    finding = RiskFinding(
        risk_tag="x", cause="c", correction="fix", severity=RiskSeverity.LOW
    )
    serialized = ToolRegistry.serialize_result(finding)
    parsed = json.loads(serialized)
    assert parsed["risk_tag"] == "x"
    assert parsed["severity"] == "low"


def test_default_registry_has_expected_tools():
    reg = build_default_registry()
    names = set(reg.tools.keys())
    assert names == {"knowledge_search", "teaching_strategy", "learning_path"}
