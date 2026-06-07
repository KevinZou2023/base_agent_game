"""Pydantic schemas for Xiangyunsha (香云纱) knowledge entries, parameters, and player state."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class CraftStage(str, Enum):
    """Production stages of Xiangyunsha (香云纱) craft."""

    PREPARE = "prepare"             # 坯绸准备
    SHULIANG_DYE = "shuliang_dye"   # 薯莨浸染
    SEAL_LIQUID = "seal_liquid"     # 封莨水
    SUN_DRY = "sun_dry"             # 晒莨
    WU_PROCESS = "wu_process"       # 过乌
    WASH = "wash"                   # 水洗
    AIR_DRY = "air_dry"             # 晾晒
    REVIEW = "review"               # 复盘


class GameStage(str, Enum):
    """High-level game stages the player can be in."""

    TASK = "task"
    MATERIAL = "material"
    PARAMETER = "parameter"
    PRE_GENERATE = "pre_generate"
    ARTWORK = "artwork"
    REVIEW = "review"


class LearnerLevel(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class ReviewedStatus(str, Enum):
    PENDING = "pending"
    REVIEWED = "reviewed"
    REJECTED = "rejected"


class RiskSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class EntryType(str, Enum):
    """The kind of knowledge record stored in the vector DB."""

    CRAFT_STEP = "craft_step"
    MATERIAL = "material"
    PARAMETER = "parameter"
    FAILURE_CASE = "failure_case"
    PATTERN = "pattern"
    CULTURE = "culture"


# ---------------------------------------------------------------------------
# Common sub-schemas
# ---------------------------------------------------------------------------


class SourceInfo(BaseModel):
    """Provenance information attached to every knowledge entry."""

    source_type: str = Field(description="manual_annotation / paper / museum / video_transcript / llm_predicted")
    source_url: Optional[str] = None
    source_title: Optional[str] = None
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    reviewed_status: ReviewedStatus = ReviewedStatus.PENDING


class ParameterRange(BaseModel):
    """A parameter and its acceptable / failure thresholds."""

    name: str
    unit: str
    qualified_min: float
    qualified_max: float
    failure_min: Optional[float] = None
    failure_max: Optional[float] = None
    description: Optional[str] = None


# ---------------------------------------------------------------------------
# Xiangyunsha operational parameters (what the player tweaks)
# ---------------------------------------------------------------------------


class XiangyunshaParameters(BaseModel):
    """Operational parameters the player adjusts during the craft.

    All values are *current* settings, not ranges. Range/threshold checking
    happens in `app.data.rules`.
    """

    model_config = ConfigDict(extra="forbid")

    # 坯绸 (base silk)
    fabric_type: str = Field(default="white_silk", description="坯绸种类: white_silk / mulberry_silk")

    # 薯莨浸染
    shuliang_concentration: float = Field(default=0.5, ge=0.0, le=1.0, description="薯莨汁浓度 (0-1)")
    dye_cycles: int = Field(default=6, ge=0, le=30, description="浸染次数")
    dye_water_temp: float = Field(default=25.0, ge=0.0, le=80.0, description="染液水温 (摄氏度)")

    # 晒莨 (sun-drying after dye)
    sun_hours: float = Field(default=6.0, ge=0.0, le=20.0, description="日晒小时数(单次)")
    sun_total_days: int = Field(default=3, ge=0, le=30, description="累计晒莨天数")

    # 过乌
    wu_mud_thickness: float = Field(default=0.5, ge=0.0, le=1.0, description="过乌泥浆涂抹厚度 (0-1)")
    wu_duration_minutes: float = Field(default=30.0, ge=0.0, le=180.0, description="过乌停留时间(分钟)")
    wu_apply_count: int = Field(default=1, ge=0, le=10, description="过乌涂抹次数")

    # 水洗 / 晾晒
    wash_water_temp: float = Field(default=20.0, ge=0.0, le=60.0, description="水洗水温(摄氏度)")
    air_dry_hours: float = Field(default=8.0, ge=0.0, le=48.0, description="晾晒时长(小时)")


# ---------------------------------------------------------------------------
# Knowledge entries (stored in ChromaDB)
# ---------------------------------------------------------------------------


class CraftStepEntry(BaseModel):
    """A single Xiangyunsha craft step (e.g. 薯莨浸染)."""

    entry_type: EntryType = EntryType.CRAFT_STEP
    step_id: str = Field(description="Unique slug, e.g. shuliang_dye_step")
    step_name: str = Field(description="Chinese step name, e.g. 薯莨浸染")
    stage: CraftStage
    purpose: str = Field(description="Why this step exists")
    procedure: str = Field(description="How the master traditionally performs it")
    parameter_ranges: list[ParameterRange] = []
    cautions: list[str] = []
    source: SourceInfo


class MaterialEntry(BaseModel):
    entry_type: EntryType = EntryType.MATERIAL
    material_id: str
    material_name: str
    category: str = Field(description="fabric / dye / mud / auxiliary")
    description: str
    properties: dict[str, Any] = Field(default_factory=dict)
    source: SourceInfo


class ParameterEntry(BaseModel):
    entry_type: EntryType = EntryType.PARAMETER
    parameter_id: str
    stage: CraftStage
    parameter: ParameterRange
    impact_on_quality: str = Field(description="How this parameter affects the final piece")
    source: SourceInfo


class FailureCase(BaseModel):
    entry_type: EntryType = EntryType.FAILURE_CASE
    case_id: str
    symptom: str = Field(description="What the defect looks like (visible to player)")
    risk_tag: str = Field(description="Canonical risk tag, must match rules.py")
    root_cause: str
    affected_parameters: list[str] = []
    master_explanation: str = Field(description="师傅口语化解释 (used by teaching_feedback_tool)")
    correction_actions: list[str] = []
    severity: RiskSeverity = RiskSeverity.MEDIUM
    source: SourceInfo


# Discriminated union for arbitrary entries (used by seed_data)
KnowledgeEntry = CraftStepEntry | MaterialEntry | ParameterEntry | FailureCase


# ---------------------------------------------------------------------------
# Rule-engine outputs
# ---------------------------------------------------------------------------


class RiskFinding(BaseModel):
    """A single risk surfaced by the rule engine."""

    risk_tag: str
    cause: str
    correction: str
    severity: RiskSeverity = RiskSeverity.MEDIUM
    rule_id: Optional[str] = None


class RuleCheckResult(BaseModel):
    """Output of `process_rule_tool`."""

    risks: list[RiskFinding] = []
    overall_severity: RiskSeverity = RiskSeverity.LOW
    passed: bool = True


# ---------------------------------------------------------------------------
# Search results
# ---------------------------------------------------------------------------


class SearchHit(BaseModel):
    document: str
    metadata: dict[str, Any]
    distance: float
    source: Optional[SourceInfo] = None


class SearchResult(BaseModel):
    query: str
    hits: list[SearchHit] = []


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------


class ScoreBreakdown(BaseModel):
    process_score: float = Field(default=0.0, ge=0.0, le=100.0, description="工艺合理性")
    pattern_score: float = Field(default=0.0, ge=0.0, le=100.0, description="纹样完成度")
    color_score: float = Field(default=0.0, ge=0.0, le=100.0, description="色彩协调度 (黑亮面/红褐底色)")
    culture_score: float = Field(default=0.0, ge=0.0, le=100.0, description="文化表达度")
    progress_score: float = Field(default=0.0, ge=0.0, le=100.0, description="学习进步度")

    @property
    def total(self) -> float:
        return (
            self.process_score
            + self.pattern_score
            + self.color_score
            + self.culture_score
            + self.progress_score
        ) / 5.0


class Deduction(BaseModel):
    dimension: str
    points: float
    reason: str
    risk_tag: Optional[str] = None


class ScoringReport(BaseModel):
    artwork_id: str
    scores: ScoreBreakdown
    deductions: list[Deduction] = []
    master_feedback: str = ""
    next_task_recommendation: Optional[str] = None


# ---------------------------------------------------------------------------
# Player state (in-memory representation used by the Agent)
# ---------------------------------------------------------------------------


class LearningEvent(BaseModel):
    occurred_at: datetime
    stage: GameStage
    risk_tag: Optional[str] = None
    note: Optional[str] = None


class PlayerState(BaseModel):
    player_id: str
    current_stage: GameStage = GameStage.TASK
    learner_level: LearnerLevel = LearnerLevel.BEGINNER
    selected_materials: dict[str, str] = Field(default_factory=dict)
    parameters: XiangyunshaParameters = Field(default_factory=XiangyunshaParameters)
    task_theme: Optional[str] = None  # e.g. "端午 · 红褐黑亮方巾"
    target_pattern: Optional[str] = None
    history: list[LearningEvent] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Agent I/O (what the master Agent returns to the caller / API layer)
# ---------------------------------------------------------------------------


class AgentResponse(BaseModel):
    """Structured output of one MasterAgent.respond() call."""

    master_reply: str = Field(description="师傅口语化反馈（面向玩家）")
    risk_tags: list[str] = Field(default_factory=list)
    hint_type: str = Field(default="explicit", description="explicit/probe/warn/encourage/silent")
    intervention_level: int = Field(default=1, ge=0, le=3)
    recommended_actions: list[str] = Field(default_factory=list)
    knowledge_used: list[str] = Field(
        default_factory=list,
        description="检索命中的知识 id 列表（透明化，方便复盘）",
    )
    operation_summary: str = ""
    stage: GameStage = GameStage.TASK
    debug: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# HTTP API request / response models (used by FastAPI routes)
# ---------------------------------------------------------------------------


class MasterChatRequest(BaseModel):
    """POST /api/v1/master/chat body."""

    player_state: PlayerState
    message: Optional[str] = None
    operation_event: Optional[dict[str, Any]] = None
    npc_id: Optional[str] = None  # NPC 标识符，用于个性化人设


class ArtworkGenerateRequest(BaseModel):
    """POST /api/v1/artwork/generate body."""

    player_id: str
    parameters: XiangyunshaParameters
    task_theme: Optional[str] = None
    target_pattern: Optional[str] = None


class ArtworkGenerateResponse(BaseModel):
    artwork_id: str
    image_url: str = Field(description="本地静态资源 URL，例如 /static/images/art_001.png")
    original_image_url: Optional[str] = Field(default=None, description="通义万相返回的原始 URL")
    prompt_used: str
    negative_prompt: str
    style_tags: list[str] = Field(default_factory=list)
    quality_hint: str = "high"
    status: str = "done"
    parameters: XiangyunshaParameters
    rule_check_passed: bool = True
    risk_tags: list[str] = Field(default_factory=list)
    created_at: datetime


class ArtworkSummary(BaseModel):
    artwork_id: str
    task_theme: Optional[str] = None
    image_url: Optional[str] = None
    status: str
    created_at: datetime


class UserStateResponse(BaseModel):
    player_id: str
    nickname: str
    level: str
    created_at: datetime
    artworks: list[ArtworkSummary] = Field(default_factory=list)
    recent_risk_tags: list[str] = Field(default_factory=list)


class UserStateUpdate(BaseModel):
    nickname: Optional[str] = None
    level: Optional[str] = None


class ErrorResponse(BaseModel):
    detail: str
    code: str = "internal_error"


# ---------------------------------------------------------------------------
# Event system (sub-goal 2: AI random events)
# ---------------------------------------------------------------------------


class EventTriggerType(str, Enum):
    TIME_BASED = "time_based" # 每 N 分钟真实时间触发
    CRAFT_RISK = "craft_risk"         # 同 risk_tag 出现 ≥N 次
    QUEST_PROGRESS = "quest_progress" # 任务步骤到达指定位置
    WEATHER_CHANGE = "weather_change" # 天气变化时
    RANDOM = "random"                 # 无条件随机概率


class GameEvent(BaseModel):
    """一个可触发的事件模板（存储在 data/events/*.json）。"""

    event_id: str = Field(description="唯一标识，如 evt_ahua_storm_warning")
    event_type: str = Field(description="事件类型，如 weather_warning / villager_request / craft_tip")
    trigger_type: EventTriggerType
    trigger_conditions: dict[str, Any] = Field(
        default_factory=dict,
        description="触发条件，如 {\"weather\": \"rainy\", \"quest_step\": 2}",
    )
    npc_id: Optional[str] = Field(default=None, description="关联的 NPC ID")
    location: Optional[str] = Field(default=None, description="事件所属场景，如 village / mountain")
    priority: int = Field(default=1, ge=0, description="优先级，高值优先触发")
    cooldown_minutes: Optional[int] = Field(default=None, description="触发后多少分钟内不重复")
    base_messages: list[str] = Field(
        default_factory=list,
        description="事件默认对话（当 LLM 生成失败时 fallback 用）",
    )
    effects: dict[str, Any] = Field(
        default_factory=dict,
        description="触发后影响，如 {\"affinity_npc\": 5}",
    )


class PendingEvent(BaseModel):
    """返回给前端的待处理事件（包含 AI生成的对话）。"""

    event_id: str
    event_type: str
    npc_id: Optional[str]
    location: Optional[str]
    priority: int
    messages: list[str] = Field(default_factory=list, description="AI生成的对话行")
    effects: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TriggerCheckResult(BaseModel):
    """事件调度器单次 tick 的评估结果。"""

    eligible_events: list[GameEvent] = Field(default_factory=list)
    player_state_snapshot: PlayerState
