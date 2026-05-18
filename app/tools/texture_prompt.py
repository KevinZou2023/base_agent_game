"""texture_prompt_tool — turn Xiangyunsha parameters into a Wanxiang-friendly prompt.

We force three things in every prompt:
  1) Lock the style as Xiangyunsha (黑亮面 + 红褐底色 + 丝绸纹理)
  2) Encode the *outcome* implied by parameters (which the rule engine just judged)
  3) Discourage off-style outputs (cartoon, neon, plastic, western dye)
"""

from __future__ import annotations

from dataclasses import dataclass

from app.data.rules import evaluate
from app.data.schemas import RuleCheckResult, XiangyunshaParameters


@dataclass(frozen=True)
class TexturePromptResult:
    prompt: str
    negative_prompt: str
    style_tags: list[str]
    quality_hint: str   # 'high' / 'medium' / 'low' (based on rule severity)


# Hard-locked style descriptors that must appear in every prompt.
STYLE_LOCK_CN = (
    "中国非遗香云纱真丝面料质感，"
    "正面具有自然黑亮光泽，背面为饱满的红褐底色，"
    "可见细腻的丝绸经纬纹理与轻微氧化纹路"
)

NEGATIVE_PROMPT = (
    "cartoon, anime, 3D render, plastic, neon color, western dye, "
    "印花, 数码印染, 化纤布料, 油画质感, 卡通, 失真"
)


def _color_phrase(params: XiangyunshaParameters, risks: list[str]) -> str:
    """Translate dye + sun params into a visual color description."""

    base_strength = params.shuliang_concentration * (params.dye_cycles / 10.0) * (params.sun_total_days / 3.0)

    if "base_color_too_light" in risks or base_strength < 0.4:
        return "底色偏浅、红褐不饱满，整体显得欠成熟"
    if base_strength > 1.3:
        return "底色深沉饱满，红褐厚重，氧化层次丰富"
    return "底色匀称，红褐适中偏暖，层次自然"


def _gloss_phrase(params: XiangyunshaParameters, risks: list[str]) -> str:
    """Translate 过乌 params into a black-glossy-face description."""

    if "wu_before_dye" in risks:
        return "黑亮面几乎未形成，仅在表面有零散黑灰斑块"
    if "wu_uneven" in risks:
        return "黑亮面出现可见花斑，深浅不一"
    if "wu_too_long" in risks:
        return "黑亮面发灰、缺乏光泽，丝绸质感变硬"
    if "wu_too_short" in risks or "gloss_insufficient" in risks:
        return "黑亮面较弱，光泽度有限"
    if "wu_apply_excessive" in risks:
        return "黑亮面厚重发硬，丝绸悬垂感降低"
    return "黑亮面均匀油亮，犹如薄漆覆面"


def _wash_phrase(params: XiangyunshaParameters, risks: list[str]) -> str:
    if "wash_temp_too_high" in risks:
        return "水洗后光泽明显流失"
    if "air_dry_insufficient" in risks:
        return "成品手感略潮"
    return "光泽稳定、手感干爽"


def _quality_hint(rule_result: RuleCheckResult) -> str:
    if rule_result.overall_severity.value == "high":
        return "low"
    if rule_result.overall_severity.value == "medium":
        return "medium"
    return "high"


def build_texture_prompt(
    parameters: XiangyunshaParameters,
    task_theme: str | None = None,
    target_pattern: str | None = None,
) -> TexturePromptResult:
    """Compose a Tongyi Wanxiang prompt + negative prompt from parameters.

    The prompt encodes *the visual outcome implied by the current parameters*,
    not just the player's intent. So if they got the parameters wrong, the AI
    will (correctly) produce a visually flawed piece.
    """

    rule_result = evaluate(parameters)
    risk_tags = [r.risk_tag for r in rule_result.risks]

    color_part = _color_phrase(parameters, risk_tags)
    gloss_part = _gloss_phrase(parameters, risk_tags)
    wash_part = _wash_phrase(parameters, risk_tags)

    theme_part = ""
    if task_theme:
        theme_part = f"，主题：{task_theme}"
    pattern_part = ""
    if target_pattern:
        pattern_part = f"，纹样取向：{target_pattern}"

    prompt = (
        STYLE_LOCK_CN
        + theme_part
        + pattern_part
        + f"。{color_part}；{gloss_part}；{wash_part}。"
        "构图为整匹面料的平铺特写或局部细节，强调真丝的天然纹理与氧化纹路，"
        "光线为自然散射光，避免强反光与塑料感。"
    )

    style_tags = [
        "xiangyunsha",
        "black_glossy_surface",
        "red_brown_base",
        "silk_grain_texture",
        "traditional_chinese_craft",
    ]
    # Add risk-derived visual tags so caller can store them on the artwork record
    for tag in risk_tags:
        style_tags.append(f"risk_{tag}")

    return TexturePromptResult(
        prompt=prompt,
        negative_prompt=NEGATIVE_PROMPT,
        style_tags=style_tags,
        quality_hint=_quality_hint(rule_result),
    )


__all__ = ["TexturePromptResult", "build_texture_prompt"]
