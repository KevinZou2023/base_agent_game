"""CLI smoke test for the master Agent.

Runs several scripted scenarios end-to-end:
    - perception → rules → knowledge_search → teaching_strategy → LLM
and prints the master's reply, hit risks, and selected knowledge.

Usage:
    python scripts/smoke_test.py
    python scripts/smoke_test.py --no-llm     # skip LLM, use fallback replies
    python scripts/smoke_test.py --scenario 2 # run only scenario index 2
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.agent.master_agent import MasterAgent
from app.data.schemas import (
    GameStage,
    LearnerLevel,
    PlayerState,
    XiangyunshaParameters,
)
from app.utils.logger import logger


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ideal_params() -> XiangyunshaParameters:
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


def _make_state(
    *,
    level: LearnerLevel = LearnerLevel.BEGINNER,
    stage: GameStage = GameStage.PARAMETER,
    **overrides,
) -> PlayerState:
    params = _ideal_params().model_dump()
    params.update(overrides)
    return PlayerState(
        player_id="smoke_player",
        current_stage=stage,
        learner_level=level,
        parameters=XiangyunshaParameters(**params),
        task_theme="端午 · 红褐黑亮方巾",
    )


# ---------------------------------------------------------------------------
# Scenarios
# ---------------------------------------------------------------------------


SCENARIOS: list[dict] = [
    {
        "name": "A. 高风险：过乌前浸染不足（wu_before_dye）",
        "state_kwargs": {"dye_cycles": 3, "wu_apply_count": 1, "wu_duration_minutes": 75.0},
        "event": {"type": "param_change", "changes": {"wu_apply_count": 1}},
        "message": "师傅，我想直接开始过乌可以吗？",
    },
    {
        "name": "B. 中风险：过乌时间过长（wu_too_long）",
        "state_kwargs": {"wu_duration_minutes": 130.0},
        "event": {"type": "param_change", "changes": {"wu_duration_minutes": 130.0}},
        "message": None,
    },
    {
        "name": "C. 中风险（新手）：水洗水温过高（wash_temp_too_high）",
        "state_kwargs": {"wash_water_temp": 45.0},
        "event": {"type": "param_change", "changes": {"wash_water_temp": 45.0}},
        "message": "这样可以吗？",
        "level": LearnerLevel.BEGINNER,
    },
    {
        "name": "D. 中风险（进阶）：水洗水温过高 → 应给追问式",
        "state_kwargs": {"wash_water_temp": 45.0},
        "event": {"type": "param_change", "changes": {"wash_water_temp": 45.0}},
        "message": None,
        "level": LearnerLevel.INTERMEDIATE,
    },
    {
        "name": "E. 多重风险：底色浅 + 浸染不足",
        "state_kwargs": {
            "shuliang_concentration": 0.2,
            "sun_hours": 2.0,
            "dye_cycles": 3,
            "wu_apply_count": 0,  # avoid R006
        },
        "event": {"type": "param_change", "changes": {"shuliang_concentration": 0.2, "sun_hours": 2.0}},
        "message": None,
    },
    {
        "name": "F. 无风险（新手） → 应给鼓励",
        "state_kwargs": {},
        "event": None,
        "message": "师傅你看我这次怎么样？",
    },
    {
        "name": "G. 无风险（进阶） → silent (canned)",
        "state_kwargs": {},
        "event": None,
        "message": None,
        "level": LearnerLevel.INTERMEDIATE,
    },
]


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


def run_scenario(agent: MasterAgent, idx: int, scenario: dict) -> None:
    level = scenario.get("level", LearnerLevel.BEGINNER)
    state = _make_state(level=level, **scenario.get("state_kwargs", {}))
    print()
    print("=" * 78)
    print(f"[#{idx}] {scenario['name']}")
    print(f"  level={level.value}  task={state.task_theme}")
    if scenario.get("event"):
        print(f"  event={scenario['event']}")
    if scenario.get("message"):
        print(f"  message={scenario['message']}")
    print("-" * 78)

    response = agent.respond(
        player_state=state,
        message=scenario.get("message"),
        operation_event=scenario.get("event"),
    )

    print(f"风险标签 : {response.risk_tags or '无'}")
    print(f"教学策略 : {response.hint_type} (level {response.intervention_level})")
    print(f"操作总结 : {response.operation_summary}")
    print(f"检索命中 : {response.knowledge_used or '—'}")
    print(f"师傅回复 : {response.master_reply}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-llm", action="store_true", help="Disable LLM (use fallback wording)")
    parser.add_argument("--scenario", type=int, default=None, help="Run only one scenario index")
    args = parser.parse_args()

    if args.no_llm:
        # Plug in a stub client that always raises so we hit the fallback path
        class FailingLLM:
            def chat(self, *a, **kw):
                raise RuntimeError("LLM disabled via --no-llm")
        agent = MasterAgent(llm=FailingLLM(), use_vector_search=False)
    else:
        agent = MasterAgent()

    scenarios = SCENARIOS if args.scenario is None else [SCENARIOS[args.scenario]]
    for i, s in enumerate(scenarios):
        try:
            run_scenario(agent, i if args.scenario is None else args.scenario, s)
        except Exception as e:
            logger.exception("Scenario {} failed: {}", i, e)


if __name__ == "__main__":
    main()
