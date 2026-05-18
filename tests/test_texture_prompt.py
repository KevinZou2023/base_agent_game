"""Tests for the texture_prompt builder."""

from __future__ import annotations

from app.data.schemas import XiangyunshaParameters
from app.tools.texture_prompt import build_texture_prompt


def _ideal() -> XiangyunshaParameters:
    return XiangyunshaParameters(
        shuliang_concentration=0.6,
        dye_cycles=10,
        dye_water_temp=28.0,
        sun_hours=6.0,
        sun_total_days=4,
        wu_mud_thickness=0.55,
        wu_duration_minutes=75.0,
        wu_apply_count=2,
        wash_water_temp=25.0,
        air_dry_hours=8.0,
    )


def test_prompt_locks_xiangyunsha_style():
    result = build_texture_prompt(_ideal())
    assert "香云纱" in result.prompt
    assert "黑亮" in result.prompt
    assert "红褐" in result.prompt
    assert "丝绸" in result.prompt
    assert result.quality_hint == "high"


def test_negative_prompt_excludes_off_style():
    result = build_texture_prompt(_ideal())
    assert "cartoon" in result.negative_prompt
    assert "印花" in result.negative_prompt
    assert "化纤" in result.negative_prompt


def test_failure_parameters_show_in_visual_description():
    bad = _ideal()
    bad.wu_duration_minutes = 130.0   # triggers wu_too_long
    result = build_texture_prompt(bad)
    assert "发灰" in result.prompt or "硬" in result.prompt
    assert result.quality_hint in ("medium", "low")
    assert any("risk_wu_too_long" == t for t in result.style_tags)


def test_theme_and_pattern_inserted():
    result = build_texture_prompt(
        _ideal(),
        task_theme="端午 · 红褐黑亮方巾",
        target_pattern="云纹",
    )
    assert "端午" in result.prompt
    assert "云纹" in result.prompt


def test_style_tags_always_include_locks():
    result = build_texture_prompt(_ideal())
    for must in ("xiangyunsha", "black_glossy_surface", "red_brown_base"):
        assert must in result.style_tags
