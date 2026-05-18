"""香云纱工艺规则矩阵 (Xiangyunsha craft rule engine).

每条规则把可观测的玩家参数组合映射到风险标签 + 原因 + 修正建议。
规则纯 Python 计算，不依赖 LLM —— Agent 只在生成口语化反馈时调用 LLM。

新增规则只需要在 RULES 列表里加一个 Rule(...) 即可，无需改其他地方。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from .schemas import (
    RiskFinding,
    RiskSeverity,
    RuleCheckResult,
    XiangyunshaParameters,
)


# ---------------------------------------------------------------------------
# Rule dataclass
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Rule:
    """A single deterministic check over XiangyunshaParameters."""

    rule_id: str
    risk_tag: str
    condition: Callable[[XiangyunshaParameters], bool]
    cause: str
    correction: str
    severity: RiskSeverity = RiskSeverity.MEDIUM


# ---------------------------------------------------------------------------
# Rules (8–12 core rules covering the main failure modes of Xiangyunsha)
# ---------------------------------------------------------------------------


RULES: list[Rule] = [
    # ----- 薯莨浸染 (shuliang dyeing) -----
    Rule(
        rule_id="R001",
        risk_tag="base_color_too_light",
        condition=lambda p: p.shuliang_concentration < 0.3 and p.sun_hours < 4,
        cause="薯莨汁浓度不足，且单次日晒时长不够，底色无法充分氧化为红褐色",
        correction="将薯莨汁浓度提高到 0.5 以上，或延长单次日晒至 6 小时以上",
        severity=RiskSeverity.MEDIUM,
    ),
    Rule(
        rule_id="R002",
        risk_tag="dye_cycles_insufficient",
        condition=lambda p: p.dye_cycles < 5,
        cause="薯莨浸染次数过少，单宁未在丝绸上充分沉积",
        correction="至少完成 8 次浸染 — 染晒循环，让底色由浅及深逐层叠加",
        severity=RiskSeverity.HIGH,
    ),
    Rule(
        rule_id="R003",
        risk_tag="dye_temp_too_high",
        condition=lambda p: p.dye_water_temp > 50.0,
        cause="染液温度过高，薯莨中的单宁分子结构受损，沉积效率下降",
        correction="将染液水温控制在 25–35°C 之间，常温浸染最稳定",
        severity=RiskSeverity.MEDIUM,
    ),
    Rule(
        rule_id="R004",
        risk_tag="dye_temp_too_low",
        condition=lambda p: p.dye_water_temp < 15.0,
        cause="染液温度过低，单宁活性不足，吸色速度过慢",
        correction="略微提高水温到 25°C 左右，但不要超过 35°C",
        severity=RiskSeverity.LOW,
    ),
    # ----- 晒莨 (sun-drying cycles) -----
    Rule(
        rule_id="R005",
        risk_tag="sun_dry_insufficient",
        condition=lambda p: p.sun_total_days < 2,
        cause="累计晒莨天数不足，薯莨在丝绸上未完成多轮氧化",
        correction="至少进行 3 天循环染晒，让红褐底色稳定沉积",
        severity=RiskSeverity.MEDIUM,
    ),
    # ----- 过乌 (the wu / mud-iron reaction) -----
    Rule(
        rule_id="R006",
        risk_tag="wu_before_dye",
        condition=lambda p: p.dye_cycles < 5 and p.wu_apply_count > 0,
        cause="未完成基础浸染就开始过乌，丝绸单宁不足，无法与河泥铁离子反应出黑亮面",
        correction="先把薯莨浸染做满 8 次以上，再进入过乌工序",
        severity=RiskSeverity.HIGH,
    ),
    Rule(
        rule_id="R007",
        risk_tag="wu_uneven",
        condition=lambda p: p.wu_apply_count > 0 and p.wu_mud_thickness < 0.3,
        cause="过乌泥浆涂抹太薄，铁单宁反应不均匀，会出现花斑",
        correction="泥浆厚度至少 0.5，且单方向均匀涂抹一遍",
        severity=RiskSeverity.HIGH,
    ),
    Rule(
        rule_id="R008",
        risk_tag="wu_too_short",
        condition=lambda p: 0 < p.wu_duration_minutes < 30.0,
        cause="过乌停留时间过短，铁单宁反应不充分，黑亮面发不出来",
        correction="过乌停留时间至少 60 分钟，标准范围 60–90 分钟",
        severity=RiskSeverity.MEDIUM,
    ),
    Rule(
        rule_id="R009",
        risk_tag="wu_too_long",
        condition=lambda p: p.wu_duration_minutes > 120.0,
        cause="过乌时间过长，铁离子过量反应，黑亮面发灰、丝绸纤维变脆",
        correction="过乌时间控制在 60–90 分钟，最长不超过 120 分钟",
        severity=RiskSeverity.MEDIUM,
    ),
    Rule(
        rule_id="R010",
        risk_tag="gloss_insufficient",
        condition=lambda p: (
            p.wu_apply_count > 0
            and p.wu_mud_thickness < 0.4
            and p.wu_duration_minutes < 60.0
        ),
        cause="过乌泥薄且停留时间不足，黑亮面光泽起不来",
        correction="涂抹厚度至少 0.5，停留 60 分钟以上，可重复涂抹 2–3 次",
        severity=RiskSeverity.HIGH,
    ),
    Rule(
        rule_id="R011",
        risk_tag="wu_apply_excessive",
        condition=lambda p: p.wu_apply_count > 5 and p.wu_mud_thickness > 0.7,
        cause="过乌涂抹次数过多且每次太厚，布料发硬、影响触感和悬垂感",
        correction="涂抹次数控制在 2–4 次，单次厚度 0.5 左右即可",
        severity=RiskSeverity.LOW,
    ),
    # ----- 水洗 + 晾晒 -----
    Rule(
        rule_id="R012",
        risk_tag="wash_temp_too_high",
        condition=lambda p: p.wash_water_temp > 35.0,
        cause="水洗温度过高，已成型的黑亮面会脱落，光泽流失",
        correction="使用常温或冷水水洗，水温控制在 30°C 以下",
        severity=RiskSeverity.MEDIUM,
    ),
    Rule(
        rule_id="R013",
        risk_tag="air_dry_insufficient",
        condition=lambda p: p.air_dry_hours < 4.0,
        cause="晾晒时间不足，残留水分会影响后续工序的稳定性",
        correction="晾晒至少 6 小时，最好选择通风背阴处自然晾干",
        severity=RiskSeverity.LOW,
    ),
]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


SEVERITY_RANK = {
    RiskSeverity.LOW: 1,
    RiskSeverity.MEDIUM: 2,
    RiskSeverity.HIGH: 3,
}


def evaluate(parameters: XiangyunshaParameters) -> RuleCheckResult:
    """Run all rules against the given parameters and aggregate results."""

    findings: list[RiskFinding] = []
    for rule in RULES:
        try:
            if rule.condition(parameters):
                findings.append(
                    RiskFinding(
                        risk_tag=rule.risk_tag,
                        cause=rule.cause,
                        correction=rule.correction,
                        severity=rule.severity,
                        rule_id=rule.rule_id,
                    )
                )
        except Exception:
            # A bad rule should never crash the evaluator
            continue

    if not findings:
        return RuleCheckResult(risks=[], overall_severity=RiskSeverity.LOW, passed=True)

    overall = max(findings, key=lambda f: SEVERITY_RANK[f.severity]).severity
    return RuleCheckResult(
        risks=findings,
        overall_severity=overall,
        passed=overall == RiskSeverity.LOW,
    )


def get_rule(rule_id: str) -> Rule | None:
    for r in RULES:
        if r.rule_id == rule_id:
            return r
    return None


__all__ = ["Rule", "RULES", "evaluate", "get_rule"]
