"""Tests for the Week 1 scoring tool skeleton."""

from __future__ import annotations

from app.data.schemas import XiangyunshaParameters
from app.tools.scoring import BASE_SCORE, score_artwork


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


def test_ideal_parameters_full_score():
    report = score_artwork("art_ideal", _ideal())
    assert report.scores.process_score == BASE_SCORE
    assert report.scores.pattern_score == BASE_SCORE
    assert report.scores.color_score == BASE_SCORE
    assert report.deductions == []


def test_violations_cause_deductions():
    p = _ideal()
    p.dye_cycles = 3  # triggers R002 (high severity, hits process_score)
    p.wu_apply_count = 0  # prevent R006 confusion
    report = score_artwork("art_bad_dye", p)
    assert report.scores.process_score < BASE_SCORE
    assert any(d.risk_tag == "dye_cycles_insufficient" for d in report.deductions)


def test_progress_bonus_when_previous_risk_resolved():
    p = _ideal()
    # Previously the player had base_color_too_light, now they fixed it.
    report = score_artwork(
        "art_improved",
        p,
        previous_risks=["base_color_too_light"],
    )
    # No new deductions, and progress score should be at or above base
    assert report.scores.progress_score >= BASE_SCORE
