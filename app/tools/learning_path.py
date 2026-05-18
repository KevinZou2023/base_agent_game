"""learning_path tool — recommend a focused practice task based on the player's history.

This is a Week 1 skeleton:
- Counts the most-repeated risk_tag in `recent_risk_tags`
- Returns a structured practice recommendation referencing the relevant
  craft stage and the parameter the player keeps getting wrong.

Week 4 will enrich this with image-feature analysis once scoring is wired up.
"""

from __future__ import annotations

from collections import Counter
from typing import Any

from app.data.rules import get_rule


# Mapping from risk_tag → (focus_stage, practice_title, practice_brief)
PRACTICE_TEMPLATES: dict[str, tuple[str, str, str]] = {
    "base_color_too_light": (
        "shuliang_dye",
        "薯莨底色专项",
        "只练薯莨浓度 + 单次日晒，目标做出标准红褐底色",
    ),
    "dye_cycles_insufficient": (
        "shuliang_dye",
        "浸染节奏专项",
        "锁定浓度和水温，专门练浸染次数与晒莨循环",
    ),
    "dye_temp_too_high": (
        "shuliang_dye",
        "染液温度专项",
        "练习常温浸染，体会水温对单宁活性的影响",
    ),
    "dye_temp_too_low": (
        "shuliang_dye",
        "染液温度专项",
        "练习常温浸染，找到 25–35°C 的稳定区间",
    ),
    "sun_dry_insufficient": (
        "sun_dry",
        "晒莨循环专项",
        "练习多日染晒循环，理解累计天数对底色稳定性的作用",
    ),
    "wu_before_dye": (
        "wu_process",
        "工序衔接专项",
        "练习'什么时候才能开始过乌'，先把浸染做满再过乌",
    ),
    "wu_uneven": (
        "wu_process",
        "过乌均匀度专项",
        "练习泥浆涂抹厚度与方向，目标做出无花斑的黑亮面",
    ),
    "wu_too_short": (
        "wu_process",
        "过乌时辰专项",
        "练习把过乌停留时间稳定在 60–90 分钟",
    ),
    "wu_too_long": (
        "wu_process",
        "过乌时辰专项",
        "练习把过乌停留时间控制在 90 分钟内，避免黑亮面发灰",
    ),
    "gloss_insufficient": (
        "wu_process",
        "黑亮面光泽专项",
        "练习厚度+时间组合，让铁单宁络合物充分沉积",
    ),
    "wu_apply_excessive": (
        "wu_process",
        "过乌节制专项",
        "练习涂抹次数控制在 2–4 次，保持布料悬垂感",
    ),
    "wash_temp_too_high": (
        "wash",
        "冷水水洗专项",
        "练习用低温清水冲洗，守住黑亮面光泽",
    ),
    "air_dry_insufficient": (
        "air_dry",
        "晾晒收尾专项",
        "练习通风背阴晾晒至少 6 小时，让成品稳定",
    ),
}


def learning_path(
    recent_risk_tags: list[str],
    learner_level: str = "beginner",
) -> dict[str, Any]:
    """Pick the most-repeated risk and suggest a focused practice.

    Returns:
        {
          "focus_risk_tag": str,
          "occurrence_count": int,
          "stage": str,
          "practice_title": str,
          "practice_brief": str,
          "correction": str,
          "rationale": str,
        }
    """

    if not recent_risk_tags:
        return {
            "focus_risk_tag": None,
            "practice_title": "综合练习",
            "practice_brief": "保持当前节奏，下一轮可以尝试更复杂的纹样目标。",
            "rationale": "近期未触发明显风险，无需专项练习。",
        }

    counter = Counter(recent_risk_tags)
    focus_tag, count = counter.most_common(1)[0]

    template = PRACTICE_TEMPLATES.get(focus_tag)
    if template is None:
        return {
            "focus_risk_tag": focus_tag,
            "occurrence_count": count,
            "practice_title": "综合练习",
            "practice_brief": "针对最近的薄弱环节做一次综合练习。",
            "rationale": f"近期 {count} 次触发 {focus_tag}，建议综合练习。",
        }

    stage, title, brief = template
    # Look up the original Rule to surface the canonical correction text
    correction = ""
    for r_id, r_obj in _iter_rules_by_tag(focus_tag):
        correction = r_obj.correction
        break

    return {
        "focus_risk_tag": focus_tag,
        "occurrence_count": count,
        "stage": stage,
        "practice_title": title,
        "practice_brief": brief,
        "correction": correction,
        "rationale": f"近期 {count} 次触发 {focus_tag}，集中精力练好这一项再前进。",
    }


def _iter_rules_by_tag(tag: str):
    """Iterate (rule_id, Rule) pairs whose risk_tag matches."""
    from app.data.rules import RULES

    for r in RULES:
        if r.risk_tag == tag:
            yield r.rule_id, r


# Backward-compat: get_rule import kept around in case future callers need it
_ = get_rule

__all__ = ["learning_path", "PRACTICE_TEMPLATES"]
