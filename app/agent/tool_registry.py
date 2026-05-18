"""Tool registry for the master Agent.

Centralized place where every tool the LLM can call is registered. Each tool
declares its name, description, JSON Schema for parameters, and the actual
Python callable. The registry produces the OpenAI/Qwen-compatible `tools`
payload and dispatches calls back to Python functions.

Tools that always run deterministically (operation_perception, process_rule)
are intentionally NOT registered here — they're invoked directly by
MasterAgent before the LLM loop, so the LLM can't skip them.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Callable

from app.utils.logger import logger


# ---------------------------------------------------------------------------
# Tool definition
# ---------------------------------------------------------------------------


@dataclass
class Tool:
    """A single tool exposed to the LLM."""

    name: str
    description: str
    parameters_schema: dict[str, Any]   # JSON Schema (OpenAI-compatible)
    handler: Callable[..., Any]

    def to_openai_format(self) -> dict[str, Any]:
        """Render as the dict shape Qwen/OpenAI expects in the `tools` parameter."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters_schema,
            },
        }


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


@dataclass
class ToolRegistry:
    tools: dict[str, Tool] = field(default_factory=dict)

    def register(self, tool: Tool) -> None:
        if tool.name in self.tools:
            logger.warning("Tool {} already registered; overwriting.", tool.name)
        self.tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self.tools.get(name)

    def schemas(self) -> list[dict[str, Any]]:
        """JSON-Schema payload to pass into LLM `tools=` parameter."""
        return [t.to_openai_format() for t in self.tools.values()]

    def execute(self, name: str, arguments: dict[str, Any] | None) -> Any:
        """Run a tool by name. Returns the tool's raw result (caller serializes)."""
        tool = self.get(name)
        if tool is None:
            return {"error": f"unknown tool: {name}", "available": list(self.tools.keys())}
        try:
            args = arguments or {}
            return tool.handler(**args)
        except TypeError as e:
            # Bad arguments — surface a structured error so the LLM can self-correct
            return {"error": f"bad arguments for {name}: {e}", "received": arguments}
        except Exception as e:
            logger.exception("Tool {} failed: {}", name, e)
            return {"error": f"tool {name} raised {type(e).__name__}: {e}"}

    @staticmethod
    def serialize_result(result: Any) -> str:
        """JSON-serialize a tool result for the `tool` message content."""
        if hasattr(result, "model_dump"):
            return json.dumps(result.model_dump(), ensure_ascii=False, default=str)
        try:
            return json.dumps(result, ensure_ascii=False, default=str)
        except (TypeError, ValueError):
            return str(result)


# ---------------------------------------------------------------------------
# Default registry for the master Agent
# ---------------------------------------------------------------------------


def build_default_registry() -> ToolRegistry:
    """Construct the registry with all tools the master Agent can call."""

    # Lazy imports so test modules can stub things out
    from app.tools.knowledge_search import knowledge_search
    from app.tools.learning_path import learning_path
    from app.tools.teaching_strategy_tool import teaching_strategy_tool

    reg = ToolRegistry()

    reg.register(Tool(
        name="knowledge_search",
        description=(
            "搜索香云纱工艺知识库。在以下情况使用：(1) 学徒主动提问工艺细节；"
            "(2) 你需要为某个规则触发的 risk_tag 拿到师傅口语化解释或案例对比；"
            "(3) 你需要某个工艺阶段的常识来组织回答。"
            "如果规则检测结果里已经给了原因和改法、学徒也没多问，**不要调这个工具**。"
        ),
        parameters_schema={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "中文搜索查询，越具体越好。例如 '过乌时间过长 黑亮面发灰'",
                },
                "risk_tag": {
                    "type": "string",
                    "description": "可选，按风险标签精确过滤。例如 'wu_too_long'",
                },
                "stage": {
                    "type": "string",
                    "description": "可选，按工艺阶段过滤。例如 'wu_process' / 'shuliang_dye' / 'sun_dry'",
                },
                "entry_type": {
                    "type": "string",
                    "description": "可选，按条目类型过滤。craft_step / material / parameter / failure_case",
                },
                "top_k": {
                    "type": "integer",
                    "description": "返回多少条命中，默认 3",
                    "default": 3,
                },
            },
            "required": ["query"],
        },
        handler=knowledge_search,
    ))

    reg.register(Tool(
        name="teaching_strategy",
        description=(
            "决定本轮回应的教学口吻和强度（warn/explicit/probe/encourage/silent）。"
            "通常你不需要主动调用，规则严重度和学徒水平就能推断；"
            "但在以下情况调用：你拿不定主意该用问句引导还是直接告知；或者学徒情绪可能需要特别处理。"
        ),
        parameters_schema={
            "type": "object",
            "properties": {
                "learner_level": {
                    "type": "string",
                    "enum": ["beginner", "intermediate", "advanced"],
                },
                "severity": {
                    "type": "string",
                    "enum": ["low", "medium", "high"],
                    "description": "当前最高风险等级，从规则结果里读",
                },
                "risk_count": {
                    "type": "integer",
                    "description": "本轮检测出的风险数量",
                },
            },
            "required": ["learner_level", "severity"],
        },
        handler=teaching_strategy_tool,
    ))

    reg.register(Tool(
        name="learning_path",
        description=(
            "根据玩家的历史错误记录，推荐下一轮专项练习任务。"
            "在以下情况调用：(1) 同一个 risk_tag 在 history 里出现 ≥2 次；"
            "(2) 学徒询问'下一步该练什么'；(3) 复盘阶段给出学习建议。"
        ),
        parameters_schema={
            "type": "object",
            "properties": {
                "recent_risk_tags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "学徒最近几轮触发过的 risk_tag 列表（含重复，按时间倒序）",
                },
                "learner_level": {
                    "type": "string",
                    "enum": ["beginner", "intermediate", "advanced"],
                },
            },
            "required": ["recent_risk_tags"],
        },
        handler=learning_path,
    ))

    return reg


__all__ = ["Tool", "ToolRegistry", "build_default_registry"]
