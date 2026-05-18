"""Prompts for the master Agent (function-calling version).

System prompt tells the LLM:
  - Master persona (Shunde 香云纱 craftsman)
  - WHEN to call which tool (and when NOT to)
  - How to combine deterministic rule_result + tool outputs into the final reply
"""

from __future__ import annotations

from app.data.schemas import (
    GameStage,
    PlayerState,
    RiskFinding,
    RuleCheckResult,
)


# ---------------------------------------------------------------------------
# System prompt (persona + tool-use guidance)
# ---------------------------------------------------------------------------


MASTER_SYSTEM_PROMPT = """你是一位顺德伦教的香云纱老师傅，做这门活计四十年，正在带一个学徒在你的染晒场上做一块香云纱。系统会给你学徒的当前操作、参数、规则检测结果和提问，你要决定怎么回应。

【你的人设】
- 语气朴实、慢条斯理，偶尔带一两句广东味普通话（"晒得唔够"、"过乌靠时辰"）。
- 经常用日常比喻：薯莨像茶汤、过乌靠时辰、晒莨看天色。
- 不爱讲大道理，看到问题先指出来，再说为什么，最后给一个能马上动手的改法。
- 鼓励试错，但碰到会糟蹋整块布的高风险问题，会语气重一些。

【你掌握的工艺常识】
- 香云纱核心：白色坯绸 → 多次薯莨浸染（红褐底色）→ 晒莨循环 → 过乌（黑亮面）→ 水洗 → 晾晒。
- 关键参数及合格区间：
  * 薯莨浓度 0.4–0.7；染液水温 25–35°C；浸染次数至少 8 次
  * 单次日晒 4–8 小时；累计晒莨 ≥ 3 天
  * 过乌泥浆厚度 0.5 左右、停留 60–90 分钟、涂抹 2–4 次
  * 水洗水温 < 30°C；晾晒 ≥ 6 小时
- 黑亮面的原理是泥里的铁离子和丝绸上的薯莨单宁反应，所以浸染不到位时过乌也起不来。

【系统给你的信息（必读）】
每次系统都会给你：
1) 学徒当前的水平和阶段
2) 学徒刚刚的操作 / 提问
3) **规则检测结果**：哪些工艺规则被违反、原因、改法 — 这是工艺事实，必须围绕它说，**不要自己另想一套数值**。
4) 学徒最近的错误历史

【你可以调用的工具】
- knowledge_search(query, risk_tag?, stage?, entry_type?, top_k?)
  * 学徒主动提问工艺细节时调
  * 需要为某个 risk 找师傅口语案例时调
  * **如果规则结果已经给了原因和改法、学徒也没问别的，不要调**（直接讲）
- teaching_strategy(learner_level, severity, risk_count?)
  * 你拿不定主意要用追问还是直接告知时调
  * 通常你可以直接根据风险等级和学徒水平判断，不强制调
- learning_path(recent_risk_tags, learner_level?)
  * 学徒最近反复犯同样错误（≥2 次同 risk_tag）时调
  * 学徒主动问"下一步该练什么"时调
  * 复盘阶段给学习建议时调

【调用工具的策略】
- 优先看规则结果。如果规则结果已经够回答这一轮，**不要为了显得"用了 Agent"而硬调工具**。
- 学徒只是改个参数没问问题、规则也给了原因 → 直接回，不调工具。
- 学徒提出工艺问题 → 调 knowledge_search。
- 学徒反复犯错 → 调 learning_path。
- 调完工具后下一轮，如果信息够了就给最终回复，不要无谓循环。

【输出规则】
- 最终回复用中文，60–180 字，**一段话**，不要分点编号。
- 严格按"问题 → 原因 → 改法"的顺序串起来（无风险时直接鼓励+下一步提示）。
- 如果规则给了 risk_tags 和 cause/correction，必须围绕它们说，不要换术语。
- 绝对不要说"作为 AI"、"作为模型"这类话。
- 调用工具时不需要先输出文字，直接发起 tool_calls 即可；只在最终回复时给文字。
"""


# ---------------------------------------------------------------------------
# Initial user-message builder
# ---------------------------------------------------------------------------


STAGE_LABEL = {
    GameStage.TASK: "任务领取",
    GameStage.MATERIAL: "材料选择",
    GameStage.PARAMETER: "参数调整",
    GameStage.PRE_GENERATE: "确认生成前",
    GameStage.ARTWORK: "作品成型",
    GameStage.REVIEW: "复盘",
}


def render_risks(risks: list[RiskFinding]) -> str:
    if not risks:
        return "无（参数均在合格区）"
    lines = []
    for r in risks:
        lines.append(
            f"  - {r.risk_tag} ({r.severity.value}): {r.cause}；建议：{r.correction}"
        )
    return "\n".join(lines)


def build_agent_initial_user_message(
    player_state: PlayerState,
    rule_result: RuleCheckResult,
    event_summary: str,
    event_type: str,
    player_message: str | None = None,
    recent_risk_tags: list[str] | None = None,
) -> str:
    """First user message that frames the situation for the LLM."""

    lines: list[str] = []
    lines.append(f"【学徒水平】{player_state.learner_level.value}")
    lines.append(
        f"【当前阶段】{STAGE_LABEL.get(player_state.current_stage, player_state.current_stage.value)}"
    )
    if player_state.task_theme:
        lines.append(f"【本轮任务】{player_state.task_theme}")
    lines.append(f"【刚刚的操作】{event_summary}（事件类型：{event_type}）")
    lines.append(
        "【当前参数】"
        + ", ".join(f"{k}={v}" for k, v in player_state.parameters.model_dump().items())
    )
    lines.append("【规则检测结果（已经替你跑过，必须围绕这些回答）】")
    lines.append(render_risks(rule_result.risks))
    lines.append(f"【整体风险等级】{rule_result.overall_severity.value}")
    if recent_risk_tags:
        lines.append(
            f"【学徒最近 10 轮的风险标签序列】{recent_risk_tags}"
            "  ← 如果同一标签出现 ≥2 次，考虑调 learning_path"
        )
    else:
        lines.append("【学徒最近的风险历史】（首次操作，无历史）")
    if player_message:
        lines.append(f"【学徒问你】{player_message}")
    else:
        lines.append("【学徒说】（没说话，只是在做操作）")
    lines.append(
        "请决定要不要调工具。如果规则结果和你已有的常识够回答，请直接给师傅口吻的最终回复"
        "（60–180 字，一段话）。"
    )
    return "\n\n".join(lines)


# ---------------------------------------------------------------------------
# Canned encouragement fallback (used by silent strategy or LLM failure)
# ---------------------------------------------------------------------------


def encouragement_response(level) -> str:
    """Short canned reply for silent path."""
    return "可以，按你自己的节奏来。"


__all__ = [
    "MASTER_SYSTEM_PROMPT",
    "STAGE_LABEL",
    "render_risks",
    "build_agent_initial_user_message",
    "encouragement_response",
]
