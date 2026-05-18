"""MasterAgent — orchestrates tools and the LLM to produce master-voice feedback.

Design choice: this is *not* a free-form ReAct agent. Tool calls happen in a
deterministic order (perception → rules → knowledge → strategy → LLM). The LLM
only handles natural-language wording of the master's reply. This makes
behaviour reproducible and bounds hallucination risk to the wording itself.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.agent.llm_client import ChatMessage, LLMClient, get_llm_client
from app.agent.prompts import (
    FEW_SHOT_EXAMPLES,
    MASTER_SYSTEM_PROMPT,
    build_user_prompt,
    encouragement_response,
)
from app.data.schemas import (
    AgentResponse,
    LearningEvent,
    PlayerState,
    SearchResult,
)
from app.tools.knowledge_search import knowledge_search
from app.tools.operation_perception import OperationEvent, apply_event_to_parameters, perceive
from app.tools.process_rule import process_rule
from app.tools.teaching_strategy import HintType, StrategyDecision, decide_teaching
from app.utils.logger import logger


class MasterAgent:
    """Coordinator that runs the master's per-turn decision loop."""

    def __init__(
        self,
        llm: LLMClient | None = None,
        *,
        use_vector_search: bool = True,
    ) -> None:
        self.llm = llm or get_llm_client()
        self.use_vector_search = use_vector_search

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def respond(
        self,
        player_state: PlayerState,
        message: str | None = None,
        operation_event: dict[str, Any] | None = None,
    ) -> AgentResponse:
        """Run one full decision turn and return the master's reply."""

        # 1) Perceive the player's action
        event: OperationEvent = perceive(player_state, operation_event)
        # Apply parameter changes into a working state so rules see the new values
        working_state = player_state.model_copy(deep=True)
        working_state.parameters = apply_event_to_parameters(working_state.parameters, event)
        working_state.current_stage = event.stage or working_state.current_stage

        # 2) Run the rule engine
        rule_result = process_rule(working_state.parameters)
        logger.info(
            "Agent rule check: {} risks (overall {})",
            len(rule_result.risks),
            rule_result.overall_severity.value,
        )

        # 3) Pick a teaching strategy
        strategy: StrategyDecision = decide_teaching(working_state, rule_result)

        # 4) Retrieve knowledge (optional, governed by strategy)
        knowledge: SearchResult | None = None
        knowledge_ids: list[str] = []
        if self.use_vector_search and not strategy.skip_llm:
            knowledge = self._retrieve_knowledge(working_state, rule_result, message)
            if knowledge:
                knowledge_ids = [
                    h.metadata.get("id_key", "") for h in knowledge.hits if h.metadata
                ]

        # 5) Either return canned line (silent strategy) or call the LLM
        if strategy.skip_llm or strategy.hint_type == HintType.SILENT:
            master_reply = encouragement_response(working_state.learner_level)
        else:
            master_reply = self._compose_master_reply(
                working_state, rule_result, knowledge, strategy, event, message
            )

        # 6) Record event into player history (for future progress scoring)
        for risk in rule_result.risks:
            player_state.history.append(
                LearningEvent(
                    occurred_at=datetime.utcnow(),
                    stage=working_state.current_stage,
                    risk_tag=risk.risk_tag,
                    note=event.summary(),
                )
            )

        # 7) Pack the structured response
        return AgentResponse(
            master_reply=master_reply,
            risk_tags=[r.risk_tag for r in rule_result.risks],
            hint_type=strategy.hint_type.value,
            intervention_level=strategy.intervention_level,
            recommended_actions=[r.correction for r in rule_result.risks],
            knowledge_used=[k for k in knowledge_ids if k],
            operation_summary=event.summary(),
            stage=working_state.current_stage,
            debug={
                "overall_severity": rule_result.overall_severity.value,
                "tone": strategy.tone,
                "event_type": event.event_type,
            },
        )

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _retrieve_knowledge(
        self,
        player_state: PlayerState,
        rule_result,
        player_message: str | None,
    ) -> SearchResult | None:
        """Build a query that joins the player's question + risk tags + stage."""

        try:
            # Prefer specific risk-tag retrieval if there are risks
            if rule_result.risks:
                tag = rule_result.risks[0].risk_tag
                query = f"{tag} {rule_result.risks[0].cause}"
                return knowledge_search(query=query, top_k=3, risk_tag=tag)
            # Otherwise stage-scoped knowledge
            stage_value = player_state.current_stage.value
            base = player_message or f"{stage_value} 香云纱 工艺要点"
            return knowledge_search(query=base, top_k=3, stage=stage_value)
        except Exception as e:
            logger.warning("knowledge_search failed: {}", e)
            return None

    def _compose_master_reply(
        self,
        player_state: PlayerState,
        rule_result,
        knowledge: SearchResult | None,
        strategy: StrategyDecision,
        event: OperationEvent,
        player_message: str | None,
    ) -> str:
        """Call the LLM with system prompt + few-shot + structured user prompt."""

        user_prompt = build_user_prompt(
            player_state=player_state,
            rule_result=rule_result,
            knowledge=knowledge,
            hint_type=strategy.hint_type.value,
            operation_summary=event.summary(),
            player_message=player_message,
        )

        messages: list[ChatMessage] = [
            {"role": "system", "content": MASTER_SYSTEM_PROMPT + "\n\n" + FEW_SHOT_EXAMPLES},
            {"role": "user", "content": user_prompt},
        ]
        try:
            # Slightly cooler when warning, warmer when explaining
            temperature = 0.4 if strategy.hint_type == HintType.WARN else 0.7
            text = self.llm.chat(messages, temperature=temperature, max_tokens=400)
            return text
        except Exception as e:
            logger.error("LLM call failed: {}", e)
            # Fallback: stitch rules + correction so we still return something useful
            return self._fallback_reply(rule_result, strategy)

    @staticmethod
    def _fallback_reply(rule_result, strategy: StrategyDecision) -> str:
        if not rule_result.risks:
            return "嗯，这一步看上去稳，继续做下去。"
        first = rule_result.risks[0]
        return f"{first.cause}。{first.correction}。"


__all__ = ["MasterAgent"]
