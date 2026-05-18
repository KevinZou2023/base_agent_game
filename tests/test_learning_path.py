"""Tests for the learning_path tool."""

from __future__ import annotations

from app.tools.learning_path import PRACTICE_TEMPLATES, learning_path


def test_empty_history_returns_default_message():
    result = learning_path(recent_risk_tags=[])
    assert result["focus_risk_tag"] is None
    assert "保持当前节奏" in result["practice_brief"] or "未触发" in result["rationale"]


def test_picks_most_common_risk():
    result = learning_path(
        recent_risk_tags=["wu_too_long", "wu_too_long", "wu_too_long", "wash_temp_too_high"],
    )
    assert result["focus_risk_tag"] == "wu_too_long"
    assert result["occurrence_count"] == 3
    assert result["stage"] == "wu_process"
    assert "过乌" in result["practice_title"]


def test_correction_field_pulled_from_rules():
    result = learning_path(recent_risk_tags=["wash_temp_too_high"])
    # Should pick up the canonical correction from rules.py
    assert result["correction"]
    assert "30" in result["correction"] or "冷水" in result["correction"]


def test_all_practice_templates_have_required_fields():
    for tag, (stage, title, brief) in PRACTICE_TEMPLATES.items():
        assert stage and isinstance(stage, str)
        assert title and isinstance(title, str)
        assert brief and isinstance(brief, str)
