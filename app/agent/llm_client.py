"""LLM client abstraction with function calling (tool_calls) support.

Default backend: DashScope Qwen (`qwen-plus`).
Backup backend: DeepSeek (`deepseek-chat`) — OpenAI-compatible HTTP.

`LLMClient.chat()` returns a `ChatResponse` that may carry either a final
text answer or a list of `tool_calls`. The Agent loop is responsible for
executing the tool calls and feeding results back.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Literal, TypedDict

import dashscope
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.utils.logger import logger


# ---------------------------------------------------------------------------
# Common types
# ---------------------------------------------------------------------------


class ChatMessage(TypedDict, total=False):
    """OpenAI-style chat message. Some fields only apply to certain roles."""

    role: Literal["system", "user", "assistant", "tool"]
    content: str
    tool_call_id: str          # only when role == "tool"
    name: str                  # only when role == "tool"
    tool_calls: list[dict]     # only when role == "assistant" and tool calls were made


@dataclass
class ToolCall:
    """A single tool invocation requested by the LLM."""

    id: str
    name: str
    arguments: dict[str, Any] = field(default_factory=dict)

    def to_message_fragment(self) -> dict[str, Any]:
        """Render this tool_call back into the assistant message format the LLM expects."""
        return {
            "id": self.id,
            "type": "function",
            "function": {
                "name": self.name,
                "arguments": json.dumps(self.arguments, ensure_ascii=False),
            },
        }


@dataclass
class ChatResponse:
    """Unified response shape across backends."""

    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    raw: Any = None

    @property
    def has_tool_calls(self) -> bool:
        return bool(self.tool_calls)


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------


class LLMClient(ABC):
    """Provider-agnostic chat interface supporting function calling."""

    @abstractmethod
    def chat(
        self,
        messages: list[ChatMessage],
        *,
        tools: list[dict] | None = None,
        tool_choice: str | dict | None = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        **kwargs: Any,
    ) -> ChatResponse:
        """Send a chat completion request. May return content or tool_calls."""


# ---------------------------------------------------------------------------
# DashScope / Qwen
# ---------------------------------------------------------------------------


class DashScopeLLM(LLMClient):
    def __init__(self, model: str | None = None, api_key: str | None = None) -> None:
        self.model = model or settings.llm_model
        self.api_key = api_key or settings.dashscope_api_key
        if not self.api_key:
            raise RuntimeError("DASHSCOPE_API_KEY is not set.")

    @retry(
        wait=wait_exponential(multiplier=1, min=2, max=10),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    def chat(
        self,
        messages: list[ChatMessage],
        *,
        tools: list[dict] | None = None,
        tool_choice: str | dict | None = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        **kwargs: Any,
    ) -> ChatResponse:
        call_kwargs: dict[str, Any] = {
            "api_key": self.api_key,
            "model": self.model,
            "messages": messages,
            "result_format": "message",
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            call_kwargs["tools"] = tools
            # Qwen uses 'auto' by default; expose tool_choice if caller asks
            if tool_choice is not None:
                call_kwargs["tool_choice"] = tool_choice
        call_kwargs.update(kwargs)

        resp = dashscope.Generation.call(**call_kwargs)
        if resp.status_code != 200:
            logger.error(
                "DashScope chat failed: status={} code={} msg={}",
                resp.status_code,
                resp.code,
                resp.message,
            )
            raise RuntimeError(f"DashScope chat error: {resp.message}")

        message = resp.output.choices[0].message
        content = (message.get("content") or "").strip()
        tool_calls: list[ToolCall] = []
        for tc in message.get("tool_calls") or []:
            func = tc.get("function", {})
            raw_args = func.get("arguments") or "{}"
            try:
                args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
            except json.JSONDecodeError:
                logger.warning("Tool args not JSON: {}", raw_args)
                args = {}
            tool_calls.append(
                ToolCall(
                    id=tc.get("id") or f"call_{len(tool_calls)}",
                    name=func.get("name", ""),
                    arguments=args,
                )
            )
        return ChatResponse(content=content, tool_calls=tool_calls, raw=resp)


# ---------------------------------------------------------------------------
# DeepSeek (OpenAI-compatible)
# ---------------------------------------------------------------------------


class DeepSeekLLM(LLMClient):
    BASE_URL = "https://api.deepseek.com/v1/chat/completions"

    def __init__(self, model: str = "deepseek-chat", api_key: str | None = None) -> None:
        self.model = model
        self.api_key = api_key or settings.deepseek_api_key
        if not self.api_key:
            raise RuntimeError("DEEPSEEK_API_KEY is not set.")

    @retry(
        wait=wait_exponential(multiplier=1, min=2, max=10),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    def chat(
        self,
        messages: list[ChatMessage],
        *,
        tools: list[dict] | None = None,
        tool_choice: str | dict | None = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        **kwargs: Any,
    ) -> ChatResponse:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            payload["tools"] = tools
            if tool_choice is not None:
                payload["tool_choice"] = tool_choice
        payload.update(kwargs)

        with httpx.Client(timeout=60.0) as client:
            r = client.post(
                self.BASE_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            r.raise_for_status()
            data = r.json()

        message = data["choices"][0]["message"]
        content = (message.get("content") or "").strip()
        tool_calls: list[ToolCall] = []
        for tc in message.get("tool_calls") or []:
            func = tc.get("function", {})
            try:
                args = json.loads(func.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            tool_calls.append(
                ToolCall(id=tc.get("id", ""), name=func.get("name", ""), arguments=args)
            )
        return ChatResponse(content=content, tool_calls=tool_calls, raw=data)


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


BackendName = Literal["dashscope", "deepseek"]
_DEFAULT_CLIENT: LLMClient | None = None


def get_llm_client(backend: BackendName = "dashscope") -> LLMClient:
    """Process-wide LLM client. Default DashScope; pass `backend='deepseek'` to switch."""
    global _DEFAULT_CLIENT
    if _DEFAULT_CLIENT is not None and backend == "dashscope":
        return _DEFAULT_CLIENT
    if backend == "dashscope":
        _DEFAULT_CLIENT = DashScopeLLM()
        return _DEFAULT_CLIENT
    if backend == "deepseek":
        return DeepSeekLLM()
    raise ValueError(f"Unknown LLM backend: {backend}")


__all__ = [
    "ChatMessage",
    "ToolCall",
    "ChatResponse",
    "LLMClient",
    "DashScopeLLM",
    "DeepSeekLLM",
    "get_llm_client",
]
