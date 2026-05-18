"""LLM client abstraction.

Default backend: DashScope Qwen (`qwen-plus`).
Backup backend: DeepSeek (`deepseek-chat`) — OpenAI-compatible HTTP.

Swappable via factory `get_llm_client(backend=...)`.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Literal, TypedDict

import dashscope
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.utils.logger import logger


# ---------------------------------------------------------------------------
# Common types
# ---------------------------------------------------------------------------


class ChatMessage(TypedDict):
    role: Literal["system", "user", "assistant"]
    content: str


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------


class LLMClient(ABC):
    """Provider-agnostic chat interface."""

    @abstractmethod
    def chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        **kwargs: Any,
    ) -> str:
        """Send a chat completion request and return the assistant text."""


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
        temperature: float = 0.7,
        max_tokens: int = 1024,
        **kwargs: Any,
    ) -> str:
        resp = dashscope.Generation.call(
            api_key=self.api_key,
            model=self.model,
            messages=messages,
            result_format="message",
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )
        if resp.status_code != 200:
            logger.error(
                "DashScope chat failed: status={} code={} msg={}",
                resp.status_code,
                resp.code,
                resp.message,
            )
            raise RuntimeError(f"DashScope chat error: {resp.message}")
        return resp.output.choices[0].message.content.strip()


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
        temperature: float = 0.7,
        max_tokens: int = 1024,
        **kwargs: Any,
    ) -> str:
        with httpx.Client(timeout=60.0) as client:
            r = client.post(
                self.BASE_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    **kwargs,
                },
            )
            r.raise_for_status()
            data = r.json()
            return data["choices"][0]["message"]["content"].strip()


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
    "LLMClient",
    "DashScopeLLM",
    "DeepSeekLLM",
    "get_llm_client",
]
