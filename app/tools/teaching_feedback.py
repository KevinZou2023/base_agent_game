"""teaching_feedback_tool — generate the master's spoken commentary on the final artwork.

Given a ScoringReport (already populated with rule-based deductions), this
asks the LLM to write a short, master-voice summary that explains each
deduction and recommends the next practice.
"""

from __future__ import annotations

from app.agent.llm_client import LLMClient, get_llm_client
from app.data.schemas import ScoringReport, XiangyunshaParameters
from app.tools.learning_path import learning_path
from app.utils.logger import logger


FEEDBACK_SYSTEM_PROMPT = """你是一位顺德伦教的香云纱老师傅。学徒刚刚完成一块香云纱，系统给了你这块布的多维评分和扣分原因。
请用 120–220 字、一段话、师傅口吻，按"亮点→扣分逐项点评→下一步建议"的顺序总评。
要求：
- 必须围绕系统给的扣分原因和 risk_tags，不要换术语
- 偶尔带广东味普通话词汇（"晒得唔够"、"靠时辰"），不要刻意
- 不要分点编号，不要"作为 AI"之类的话
- 结尾给一个具体的下一步练习方向
"""


def _render_scores(report: ScoringReport) -> str:
    s = report.scores
    return (
        f"  工艺合理性: {s.process_score:.0f}\n"
        f"  纹样完成度: {s.pattern_score:.0f}\n"
        f"  色彩协调度: {s.color_score:.0f}\n"
        f"  文化表达度: {s.culture_score:.0f}\n"
        f"  学习进步度: {s.progress_score:.0f}\n"
        f"  综合: {s.total:.0f}"
    )


def _render_deductions(report: ScoringReport) -> str:
    if not report.deductions:
        return "（无扣分）"
    lines = []
    for d in report.deductions:
        lines.append(f"  - {d.dimension} -{d.points:.0f}: {d.reason}（{d.risk_tag or '—'}）")
    return "\n".join(lines)


def build_master_feedback(
    report: ScoringReport,
    parameters: XiangyunshaParameters,
    task_theme: str | None = None,
    recent_risk_tags: list[str] | None = None,
    llm: LLMClient | None = None,
) -> ScoringReport:
    """Enrich a ScoringReport in-place with master_feedback and next_task_recommendation."""

    # Always compute a learning-path suggestion to feed into the recommendation
    risk_tags = recent_risk_tags or [d.risk_tag for d in report.deductions if d.risk_tag]
    path = learning_path(recent_risk_tags=risk_tags) if risk_tags else None

    user_msg = (
        f"【本轮任务】{task_theme or '常规练习'}\n\n"
        f"【最终参数】{', '.join(f'{k}={v}' for k, v in parameters.model_dump().items())}\n\n"
        f"【评分】\n{_render_scores(report)}\n\n"
        f"【扣分明细】\n{_render_deductions(report)}\n\n"
        f"【最近风险序列】{risk_tags or '（无）'}\n\n"
        f"【系统推荐的下一关】{path or '（无）'}\n\n"
        "请按系统提示给一段师傅口吻的总评。"
    )

    client = llm or get_llm_client()
    try:
        resp = client.chat(
            [
                {"role": "system", "content": FEEDBACK_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.7,
            max_tokens=400,
        )
        report.master_feedback = resp.content or _fallback_feedback(report)
    except Exception as e:
        logger.warning("Master feedback LLM failed, falling back: {}", e)
        report.master_feedback = _fallback_feedback(report)

    if path and path.get("practice_title"):
        report.next_task_recommendation = f"{path['practice_title']}：{path.get('practice_brief', '')}"
    else:
        report.next_task_recommendation = "保持当前节奏，可尝试更复杂的纹样目标。"

    return report


def _fallback_feedback(report: ScoringReport) -> str:
    if not report.deductions:
        return "总体稳得住，五项都过得去，下一关可以挑战更难的纹样目标。"
    head = "整体节奏还可以，但有几处要拎清楚。"
    detail_lines = []
    for d in report.deductions[:3]:
        detail_lines.append(f"{d.reason}（扣 {d.points:.0f}）")
    return head + " " + "；".join(detail_lines) + "。下次按这几条改。"


__all__ = ["build_master_feedback"]
