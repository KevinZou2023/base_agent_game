"""DashScope API 调用验证脚本.

打印每次调用的 request_id 和 usage（token 数），方便去
https://dashscope.console.aliyun.com/overview 后台对账。
"""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import dashscope

from app.config import settings


def divider(label: str) -> None:
    print()
    print("=" * 70)
    print(label)
    print("=" * 70)


def verify_llm() -> None:
    divider("【验证 1】Qwen LLM (qwen-plus)")
    print(f"API Key 前缀: {settings.dashscope_api_key[:8]}...{settings.dashscope_api_key[-4:]}")
    print(f"Model: {settings.llm_model}")
    print()

    resp = dashscope.Generation.call(
        api_key=settings.dashscope_api_key,
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": "你是一个简短的助手，只回答一个词。"},
            {"role": "user", "content": "1+1 等于几？"},
        ],
        result_format="message",
        max_tokens=20,
    )
    print(f"HTTP Status: {resp.status_code}")
    print(f"Request ID:  {resp.request_id}")
    print(f"Usage:       {resp.usage}")
    print(f"Output:      {resp.output.choices[0].message.content!r}")


def verify_embedding() -> None:
    divider("【验证 2】Embedding (text-embedding-v3)")
    print(f"Model: {settings.embedding_model}")
    print()

    resp = dashscope.TextEmbedding.call(
        api_key=settings.dashscope_api_key,
        model=settings.embedding_model,
        input=["香云纱过乌时间过长会怎样？", "薯莨汁浓度的合格区间"],
    )
    print(f"HTTP Status: {resp.status_code}")
    print(f"Request ID:  {resp.request_id}")
    print(f"Usage:       {resp.usage}")
    embeddings = resp.output.get("embeddings", [])
    print(f"返回向量数量: {len(embeddings)}")
    if embeddings:
        first = embeddings[0]
        print(f"第一条向量维度: {len(first['embedding'])}")
        print(f"前 5 个分量: {first['embedding'][:5]}")


def verify_function_calling() -> None:
    divider("【验证 3】Qwen Function Calling")
    print(f"Model: {settings.llm_model}")
    print()

    resp = dashscope.Generation.call(
        api_key=settings.dashscope_api_key,
        model=settings.llm_model,
        messages=[
            {"role": "user", "content": "帮我查一下广州的天气"},
        ],
        tools=[{
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "查询某个城市的天气",
                "parameters": {
                    "type": "object",
                    "properties": {"city": {"type": "string"}},
                    "required": ["city"],
                },
            },
        }],
        result_format="message",
        max_tokens=100,
    )
    print(f"HTTP Status: {resp.status_code}")
    print(f"Request ID:  {resp.request_id}")
    print(f"Usage:       {resp.usage}")
    msg = resp.output.choices[0].message
    print(f"Content:     {msg.get('content', '')!r}")
    tool_calls = msg.get("tool_calls") or []
    print(f"Tool Calls:  {tool_calls}")


def main() -> None:
    if not settings.dashscope_api_key:
        print("ERROR: DASHSCOPE_API_KEY 未设置")
        sys.exit(1)

    verify_llm()
    verify_embedding()
    verify_function_calling()

    print()
    print("=" * 70)
    print("✅ 所有调用成功完成")
    print()
    print("去这里核对 request_id 和 usage:")
    print("  https://dashscope.console.aliyun.com/overview")
    print("  或 https://bailian.console.aliyun.com/?tab=usage")
    print("=" * 70)


if __name__ == "__main__":
    main()
