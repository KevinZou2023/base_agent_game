"""operation_perception_tool — turn raw player events into structured operation summaries."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.data.schemas import (
    GameStage,
    PlayerState,
    XiangyunshaParameters,
)


# Map parameter names to which craft stage they affect.
PARAM_TO_STAGE: dict[str, GameStage] = {
    "fabric_type": GameStage.MATERIAL,
    "shuliang_concentration": GameStage.PARAMETER,
    "dye_cycles": GameStage.PARAMETER,
    "dye_water_temp": GameStage.PARAMETER,
    "sun_hours": GameStage.PARAMETER,
    "sun_total_days": GameStage.PARAMETER,
    "wu_mud_thickness": GameStage.PARAMETER,
    "wu_duration_minutes": GameStage.PARAMETER,
    "wu_apply_count": GameStage.PARAMETER,
    "wash_water_temp": GameStage.PARAMETER,
    "air_dry_hours": GameStage.PARAMETER,
}

# Human-readable label for each tunable param (for natural-language summaries).
PARAM_LABEL_CN: dict[str, tuple[str, str]] = {
    "shuliang_concentration": ("薯莨浓度", ""),
    "dye_cycles": ("浸染次数", "次"),
    "dye_water_temp": ("染液水温", "°C"),
    "sun_hours": ("单次日晒", "小时"),
    "sun_total_days": ("累计晒莨", "天"),
    "wu_mud_thickness": ("过乌泥厚度", ""),
    "wu_duration_minutes": ("过乌时间", "分钟"),
    "wu_apply_count": ("过乌涂抹次数", "次"),
    "wash_water_temp": ("水洗水温", "°C"),
    "air_dry_hours": ("晾晒时长", "小时"),
}


@dataclass(frozen=True)
class OperationEvent:
    """A typed view over what the player just did."""

    event_type: str                       # e.g. "param_change" / "material_select" / "submit"
    stage: GameStage
    changed_parameters: dict[str, Any]    # param_name → new_value
    raw: dict[str, Any]                   # original payload (for logging)

    def summary(self) -> str:
        if self.event_type == "param_change" and self.changed_parameters:
            parts = []
            for name, value in self.changed_parameters.items():
                label_cn, unit = PARAM_LABEL_CN.get(name, (name, ""))
                parts.append(f"{label_cn}={value}{unit}")
            return "调整了 " + "、".join(parts)
        if self.event_type == "material_select":
            return "选择了材料：" + str(self.changed_parameters)
        if self.event_type == "submit":
            return "确认生成作品"
        return f"{self.event_type}: {self.raw}"


def perceive(
    player_state: PlayerState,
    raw_event: dict[str, Any] | None,
) -> OperationEvent:
    """Normalize a raw event payload into a structured OperationEvent.

    Expected shapes of raw_event (all keys optional):
        {"type": "param_change", "changes": {"wu_duration_minutes": 130}}
        {"type": "material_select", "material_id": "white_silk_plain"}
        {"type": "submit"}
    """

    if not raw_event:
        return OperationEvent(
            event_type="idle",
            stage=player_state.current_stage,
            changed_parameters={},
            raw={},
        )

    et = raw_event.get("type") or "param_change"

    if et == "param_change":
        changes = raw_event.get("changes") or {}
        # Infer stage from the first changed parameter
        first_param = next(iter(changes), None)
        stage = PARAM_TO_STAGE.get(first_param, player_state.current_stage) if first_param else player_state.current_stage
        return OperationEvent(
            event_type=et,
            stage=stage,
            changed_parameters=dict(changes),
            raw=dict(raw_event),
        )

    if et == "material_select":
        return OperationEvent(
            event_type=et,
            stage=GameStage.MATERIAL,
            changed_parameters={"material_id": raw_event.get("material_id")},
            raw=dict(raw_event),
        )

    if et == "submit":
        return OperationEvent(
            event_type=et,
            stage=GameStage.PRE_GENERATE,
            changed_parameters={},
            raw=dict(raw_event),
        )

    return OperationEvent(
        event_type=et,
        stage=player_state.current_stage,
        changed_parameters={},
        raw=dict(raw_event),
    )


def apply_event_to_parameters(
    parameters: XiangyunshaParameters,
    event: OperationEvent,
) -> XiangyunshaParameters:
    """Return a new XiangyunshaParameters with the event's changes applied."""
    if event.event_type != "param_change" or not event.changed_parameters:
        return parameters
    data = parameters.model_dump()
    for k, v in event.changed_parameters.items():
        if k in data:
            data[k] = v
    return XiangyunshaParameters(**data)


__all__ = [
    "OperationEvent",
    "PARAM_TO_STAGE",
    "PARAM_LABEL_CN",
    "perceive",
    "apply_event_to_parameters",
]
