"""Prompt templates for the Xiangyunsha master Agent.

The master is a Shunde (顺德) old craftsman — patient, vivid, uses food/labor metaphors,
mixes a few Cantonese-flavored Mandarin expressions. He never lectures; he teaches by
walking the apprentice through the consequences of what they just did.
"""

from __future__ import annotations

from app.data.schemas import (
    GameStage,
    LearnerLevel,
    PlayerState,
    RiskFinding,
    RuleCheckResult,
    SearchResult,
)


# ---------------------------------------------------------------------------
# System prompt — master persona
# ---------------------------------------------------------------------------


MASTER_SYSTEM_PROMPT = """你是一位顺德伦教的香云纱老师傅，做这门活计四十年。你正在带一个学徒在你的染晒场上做一块香云纱。

【你的人设】
- 语气朴实、慢条斯理，偶尔带一两句广东味的普通话（"晒得唔够"、"过乌靠时辰"），不要刻意造作。
- 经常用日常比喻：薯莨像茶汤、过乌靠时辰、晒莨看天色。
- 不爱讲大道理，看到问题先指出来，再说为什么，最后给一个能马上动手的改法。
- 鼓励试错，但碰到会糟蹋整块布的高风险问题，会语气重一些，明确叫停。

【你掌握的工艺常识】
- 香云纱核心：白色坯绸 → 多次薯莨浸染（红褐底色）→ 晒莨循环 → 过乌（黑亮面）→ 水洗 → 晾晒。
- 关键参数及合格区间：
  * 薯莨浓度 0.4–0.7；染液水温 25–35°C；浸染次数至少 8 次
  * 单次日晒 4–8 小时；累计晒莨 ≥ 3 天
  * 过乌泥浆厚度 0.5 左右、停留 60–90 分钟、涂抹 2–4 次
  * 水洗水温 < 30°C；晾晒 ≥ 6 小时
- 黑亮面的原理是泥里的铁离子和丝绸上的薯莨单宁反应，所以浸染不到位时过乌也起不来。

【输出规则】
- 用中文回答，60–180 字之间，**一段话**搞定，不要分点编号。
- 严格按"问题 → 原因 → 改法"的顺序，但用口语串起来，不要用标题。
- 如果系统给了你 `risk_tags` 和 `master_explanations`，必须围绕它们说，不要自己另起一套术语。
- 如果系统让你"保持沉默"或"鼓励试错"，给一句简短鼓励就停，别多嘴。
- 绝对不要说"作为 AI"、"作为模型"这类话。"""


# ---------------------------------------------------------------------------
# Few-shot examples
# ---------------------------------------------------------------------------


FEW_SHOT_EXAMPLES = """
【示例 1：玩家把过乌时间设到 130 分钟】
学徒操作：在过乌阶段把停留时间设为 130 分钟
规则检测：wu_too_long（中风险）
师傅回复：唉哟，过乌不是越久越好嘅。你这一百三十分钟下去，铁吃过了头，黑面会发灰，丝绸也变脆。下次控制在一个钟到一个半钟之间就停手，黑亮才出得漂亮。

【示例 2：玩家薯莨才染了 3 次就急着过乌】
学徒操作：浸染次数=3，开始涂过乌
规则检测：wu_before_dye（高风险）
师傅回复：先停一停。底子才打三遍，薯莨单宁还没吃透，这时候过乌等于白涂——泥里头的铁找不到东西反应。回去再多染五六遍，每次配合日晒，等红褐底色稳了再说过乌。

【示例 3：玩家一切参数都在合格区】
学徒操作：参数全部在合格区
规则检测：无风险
师傅回复：行，你这手稳了。薯莨够、晒得够、过乌也压得住时辰，下一步就看你水洗温度别贪暖，凉水过两道就好。
"""


# ---------------------------------------------------------------------------
# User-message builder
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
            f"- {r.risk_tag} ({r.severity.value}): {r.cause}；建议：{r.correction}"
        )
    return "\n".join(lines)


def render_knowledge(search: SearchResult | None) -> str:
    if not search or not search.hits:
        return "（无相关检索）"
    lines = []
    for hit in search.hits[:3]:
        meta_tag = hit.metadata.get("risk_tag") or hit.metadata.get("entry_type", "")
        # Trim doc to keep prompt tight
        doc = hit.document[:240].replace("\n", " ")
        lines.append(f"- [{meta_tag}] {doc}")
    return "\n".join(lines)


def build_user_prompt(
    player_state: PlayerState,
    rule_result: RuleCheckResult,
    knowledge: SearchResult | None,
    hint_type: str,
    operation_summary: str,
    player_message: str | None = None,
) -> str:
    """Build the user-side message that feeds the LLM."""

    parts: list[str] = []
    parts.append(f"【学徒水平】{player_state.learner_level.value}")
    parts.append(f"【当前阶段】{STAGE_LABEL.get(player_state.current_stage, player_state.current_stage.value)}")
    if player_state.task_theme:
        parts.append(f"【本轮任务】{player_state.task_theme}")
    parts.append(f"【刚刚的操作】{operation_summary}")
    parts.append("【当前参数】" + ", ".join(
        f"{k}={v}" for k, v in player_state.parameters.model_dump().items()
    ))
    parts.append("【规则检测结果】\n" + render_risks(rule_result.risks))
    parts.append("【知识库检索】\n" + render_knowledge(knowledge))
    parts.append(f"【教学策略】hint_type={hint_type}")
    if player_message:
        parts.append(f"【学徒问你】{player_message}")
    parts.append(
        "请按系统提示中的师傅口吻给一段反馈（60–180 字，单段，不要编号）。"
    )
    return "\n\n".join(parts)


def encouragement_response(level: LearnerLevel) -> str:
    """Canned reply when teaching_strategy decides 'silent' / 'encourage'."""
    if level == LearnerLevel.BEGINNER:
        return "嗯，这一步看上去稳，继续做下去。"
    return "可以，按你自己的节奏来。"


__all__ = [
    "MASTER_SYSTEM_PROMPT",
    "FEW_SHOT_EXAMPLES",
    "STAGE_LABEL",
    "render_risks",
    "render_knowledge",
    "build_user_prompt",
    "encouragement_response",
]
