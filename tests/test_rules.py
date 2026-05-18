"""Tests for the Xiangyunsha rule engine."""

from __future__ import annotations

import pytest

from app.data.rules import RULES, evaluate, get_rule
from app.data.schemas import RiskSeverity, XiangyunshaParameters


# ---------------------------------------------------------------------------
# A well-formed "ideal master" parameter set — should trigger NO rules
# ---------------------------------------------------------------------------


def ideal_parameters() -> XiangyunshaParameters:
    return XiangyunshaParameters(
        fabric_type="white_silk",
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


def test_ideal_parameters_pass():
    result = evaluate(ideal_parameters())
    assert result.passed, f"Expected no risks, got: {[r.risk_tag for r in result.risks]}"
    assert result.overall_severity == RiskSeverity.LOW
    assert result.risks == []


# ---------------------------------------------------------------------------
# Per-rule trigger + non-trigger tests
# ---------------------------------------------------------------------------


def _with(**overrides) -> XiangyunshaParameters:
    base = ideal_parameters().model_dump()
    base.update(overrides)
    return XiangyunshaParameters(**base)


def _has_risk(result, tag: str) -> bool:
    return any(r.risk_tag == tag for r in result.risks)


def test_R001_base_color_too_light():
    p = _with(shuliang_concentration=0.2, sun_hours=2.0)
    assert _has_risk(evaluate(p), "base_color_too_light")


def test_R002_dye_cycles_insufficient():
    p = _with(dye_cycles=3, wu_apply_count=0)  # disable R006 by setting wu=0
    assert _has_risk(evaluate(p), "dye_cycles_insufficient")


def test_R003_dye_temp_too_high():
    p = _with(dye_water_temp=60.0)
    assert _has_risk(evaluate(p), "dye_temp_too_high")


def test_R004_dye_temp_too_low():
    p = _with(dye_water_temp=10.0)
    assert _has_risk(evaluate(p), "dye_temp_too_low")


def test_R005_sun_dry_insufficient():
    p = _with(sun_total_days=1)
    assert _has_risk(evaluate(p), "sun_dry_insufficient")


def test_R006_wu_before_dye():
    p = _with(dye_cycles=3, wu_apply_count=2)
    assert _has_risk(evaluate(p), "wu_before_dye")


def test_R007_wu_uneven():
    p = _with(wu_apply_count=2, wu_mud_thickness=0.2)
    assert _has_risk(evaluate(p), "wu_uneven")


def test_R008_wu_too_short():
    p = _with(wu_duration_minutes=15.0)
    assert _has_risk(evaluate(p), "wu_too_short")


def test_R009_wu_too_long():
    p = _with(wu_duration_minutes=150.0)
    assert _has_risk(evaluate(p), "wu_too_long")


def test_R010_gloss_insufficient():
    p = _with(wu_apply_count=1, wu_mud_thickness=0.35, wu_duration_minutes=45.0)
    assert _has_risk(evaluate(p), "gloss_insufficient")


def test_R011_wu_apply_excessive():
    p = _with(wu_apply_count=6, wu_mud_thickness=0.8)
    assert _has_risk(evaluate(p), "wu_apply_excessive")


def test_R012_wash_temp_too_high():
    p = _with(wash_water_temp=45.0)
    assert _has_risk(evaluate(p), "wash_temp_too_high")


def test_R013_air_dry_insufficient():
    p = _with(air_dry_hours=2.0)
    assert _has_risk(evaluate(p), "air_dry_insufficient")


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------


def test_overall_severity_is_max():
    # mix LOW (R013) + HIGH (R002)
    p = _with(air_dry_hours=2.0, dye_cycles=2, wu_apply_count=0)
    result = evaluate(p)
    assert _has_risk(result, "air_dry_insufficient")
    assert _has_risk(result, "dye_cycles_insufficient")
    assert result.overall_severity == RiskSeverity.HIGH
    assert not result.passed


def test_get_rule_by_id():
    rule = get_rule("R001")
    assert rule is not None
    assert rule.risk_tag == "base_color_too_light"
    assert get_rule("nonexistent") is None


def test_every_rule_has_unique_id():
    ids = [r.rule_id for r in RULES]
    assert len(ids) == len(set(ids)), "Rule IDs must be unique"


def test_every_rule_has_unique_risk_tag():
    tags = [r.risk_tag for r in RULES]
    assert len(tags) == len(set(tags)), "Risk tags must be unique"
