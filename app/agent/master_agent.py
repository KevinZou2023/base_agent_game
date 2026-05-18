"""MasterAgent — hybrid Agent with deterministic guardrail + LLM function calling.

Architecture:
  [deterministic layer]  operation_perception → process_rule
      ↓
  [agent layer]  LLM loop with function calling
      - Tools registered: knowledge_search, teaching_strategy, learning_path
      - LLM decides which to call, in what order, with what args
      - Loop terminates when LLM returns content with no tool_calls
      - Hard cap on iterations to prevent runaway loops

Why this split (vs full ReAct):
  - The rule engine is the *fact* layer for Xiangyunsha craft. It must always
    run so the LLM cannot skip/misjudge thresholds (薯莨 concentration, 过乌
    time, etc.). Its result is injected directly into the LLM context as a
    constraint the model must address.
  - The LLM is the *teaching behavior* layer. It chooses whether to search
    knowledge, ask the strategy oracle, recommend a learning path, or just
    answer directly — based on what the player just did and asked.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from app.agent.llm_client import (
    ChatMessage,
    ChatResponse,
    LLMClient,
    ToolCall,
    get_llm_client,
)
from app.agent.prompts import (
    MASTER_SYSTEM_PROMPT,
    build_agent_initial_user_message,
)
from app.agent.tool_registry import ToolRegistry, build_default_registry
from app.data.schemas import (
    AgentResponse,
    LearningEvent,
    PlayerState,
)
from app.tools.operation_perception import OperationEvent, apply_event_to_parameters, perceive
from app.tools.process_rule import process_rule
from app.utils.logger import logger


MAX_TOOL_ITERATIONS = 4  # cap on LLM tool-calling rounds per turn


class MasterAgent:
    """Hybrid Agent: deterministic rule guardrail + LLM function-calling loop."""

    def __init__(
        self,
        llm: LLMClient | None = None,
        registry: ToolRegistry | None = None,
        *,
        max_iterations: int = MAX_TOOL_ITERATIONS,
    ) -> None:
        self.llm = llm or get_llm_client()
        self.registry = registry if registry is not None else build_default_registry()
        self.max_iterations = max_iterations

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def respond(
        self,
        player_state: PlayerState,
        message: str | None = None,
        operation_event: dict[str, Any] | None = None,
    ) -> AgentResponse:
        """Run one full Agent turn. Returns master-voice reply + structured metadata."""

        # ---- 1) Deterministic layer (NOT exposed to LLM as choices) ----
        event: OperationEvent = perceive(player_state, operation_event)
        working_state = player_state.model_copy(deep=True)
        working_state.parameters = apply_event_to_parameters(working_state.parameters, event)
        working_state.current_stage = event.stage or working_state.current_stage

        rule_result = process_rule(working_state.parameters)
        logger.info(
            "[deterministic] perception={} rule_risks={} severity={}",
            event.event_type,
            len(rule_result.risks),
            rule_result.overall_severity.value,
        )

        # ---- 2) Agent loop with function calling ----
        tool_call_log: list[dict[str, Any]] = []
        messages: list[ChatMessage] = self._build_initial_messages(
            working_state, rule_result, event, message
        )
        final_reply: str | None = None

        for iteration in range(self.max_iterations):
            try:
                resp: ChatResponse = self.llm.chat(
                    messages,
                    tools=self.registry.schemas(),
                    tool_choice="auto",
                    temperature=0.7,
                    max_tokens=600,
                )
            except Exception as e:
                logger.error("LLM call failed on iter {}: {}", iteration, e)
                final_reply = self._fallback_reply(rule_result)
                break

            if not resp.has_tool_calls:
                final_reply = resp.content or self._fallback_reply(rule_result)
                logger.info("[agent] iter {} → final reply ({} chars)", iteration, len(final_reply))
                break

            # Append the assistant message announcing the tool calls
            messages.append({
                "role": "assistant",
                "content": resp.content or "",
                "tool_calls": [tc.to_message_fragment() for tc in resp.tool_calls],
            })

            # Execute each tool call and feed result back
            for call in resp.tool_calls:
                result = self.registry.execute(call.name, call.arguments)
                result_text = self.registry.serialize_result(result)
                logger.info(
                    "[agent] iter {} tool_call {}({}) → {}",
                    iteration,
                    call.name,
                    json.dumps(call.arguments, ensure_ascii=False)[:80],
                    result_text[:100],
                )
                tool_call_log.append({
                    "iter": iteration,
                    "name": call.name,
                    "arguments": call.arguments,
                    "result_preview": result_text[:200],
                })
                messages.append({
                    "role": "tool",
                    "tool_call_id": call.id,
                    "name": call.name,
                    "content": result_text,
                })
        else:
            # Loop exhausted without final reply
            logger.warning(
                "Agent loop hit max iterations ({}); falling back.", self.max_iterations
            )
            final_reply = self._fallback_reply(rule_result)

        # ---- 3) Update player history with risks observed this turn ----
        for risk in rule_result.risks:
            player_state.history.append(
                LearningEvent(
                    occurred_at=datetime.utcnow(),
                    stage=working_state.current_stage,
                    risk_tag=risk.risk_tag,
                    note=event.summary(),
                )
            )

        # ---- 4) Pack the structured response ----
        knowledge_used = self._extract_knowledge_ids(tool_call_log)
        hint_type, intervention_level = self._extract_strategy(tool_call_log, rule_result)

        return AgentResponse(
            master_reply=final_reply or "",
            risk_tags=[r.risk_tag for r in rule_result.risks],
            hint_type=hint_type,
            intervention_level=intervention_level,
            recommended_actions=[r.correction for r in rule_result.risks],
            knowledge_used=knowledge_used,
            operation_summary=event.summary(),
            stage=working_state.current_stage,
            debug={
                "overall_severity": rule_result.overall_severity.value,
                "event_type": event.event_type,
                "tool_calls": tool_call_log,
                "iterations": len(tool_call_log) and tool_call_log[-1]["iter"] + 1 or 0,
            },
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _build_initial_messages(
        self,
        player_state: PlayerState,
        rule_result,
        event: OperationEvent,
        player_message: str | None,
    ) -> list[ChatMessage]:
        """Build system + user messages for the first LLM turn."""

        user_content = build_agent_initial_user_message(
            player_state=player_state,
            rule_result=rule_result,
            event_summary=event.summary(),
            event_type=event.event_type,
            player_message=player_message,
            recent_risk_tags=[h.risk_tag for h in player_state.history if h.risk_tag][-10:],
        )
        return [
            {"role": "system", "content": MASTER_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]

    @staticmethod
    def _fallback_reply(rule_result) -> str:
        """Deterministic backup reply when LLM fails or loop runs away."""
        if not rule_result.risks:
            return "嗯，这一步看上去稳，继续做下去。"
        first = rule_result.risks[0]
        return f"{first.cause}。{first.correction}。"

    @staticmethod
    def _extract_knowledge_ids(tool_call_log: list[dict]) -> list[str]:
        ids: list[str] = []
        for entry in tool_call_log:
            if entry["name"] != "knowledge_search":
                continue
            preview = entry.get("result_preview", "")
            # Best-effort extraction; result preview is a JSON snippet
            for token in ("FC0", "param_", "shuliang_", "wu_", "sun_dry_", "wash_", "air_dry_", "prepare_"):
                start = 0
                while True:
                    idx = preview.find(token, start)
                    if idx == -1:
                        break
                    end = idx
                    while end < len(preview) and (preview[end].isalnum() or preview[end] == "_"):
                        end += 1
                    fragment = preview[idx:end]
                    if fragment and fragment not in ids:
                        ids.append(fragment)
                    start = end
        return ids[:10]

    @staticmethod
    def _extract_strategy(tool_call_log: list[dict], rule_result) -> tuple[str, int]:
        """Pick hint_type/intervention_level from a teaching_strategy call if any."""
        for entry in reversed(tool_call_log):
            if entry["name"] != "teaching_strategy":
                continue
            preview = entry.get("result_preview", "")
            for h in ("warn", "explicit", "probe", "encourage", "silent"):
                if f'"hint_type": "{h}"' in preview:
                    level_map = {"warn": 3, "explicit": 2, "probe": 2, "encourage": 1, "silent": 0}
                    return h, level_map[h]
        # Default inferred from rule severity
        sev = rule_result.overall_severity.value
        if sev == "high":
            return "warn", 3
        if sev == "medium":
            return "explicit", 2
        if rule_result.risks:
            return "explicit", 1
        return "encourage", 1


__all__ = ["MasterAgent", "MAX_TOOL_ITERATIONS"]
