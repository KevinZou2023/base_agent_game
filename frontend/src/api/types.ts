/**
 * TypeScript mirrors of the backend Pydantic schemas (app/data/schemas.py).
 * Keep field names in sync with the FastAPI contract.
 */

export type CraftStage =
  | 'prepare'
  | 'shuliang_dye'
  | 'seal_liquid'
  | 'sun_dry'
  | 'wu_process'
  | 'wash'
  | 'air_dry'
  | 'review'

export type GameStage =
  | 'task'
  | 'material'
  | 'parameter'
  | 'pre_generate'
  | 'artwork'
  | 'review'

export type LearnerLevel = 'beginner' | 'intermediate' | 'advanced'
export type RiskSeverity = 'low' | 'medium' | 'high'

/** Operational parameters the player adjusts during the craft. */
export interface XiangyunshaParameters {
  fabric_type: string
  shuliang_concentration: number
  dye_cycles: number
  dye_water_temp: number
  sun_hours: number
  sun_total_days: number
  wu_mud_thickness: number
  wu_duration_minutes: number
  wu_apply_count: number
  wash_water_temp: number
  air_dry_hours: number
}

export const DEFAULT_PARAMETERS: XiangyunshaParameters = {
  fabric_type: 'white_silk',
  shuliang_concentration: 0.5,
  dye_cycles: 6,
  dye_water_temp: 25,
  sun_hours: 6,
  sun_total_days: 3,
  wu_mud_thickness: 0.5,
  wu_duration_minutes: 30,
  wu_apply_count: 1,
  wash_water_temp: 20,
  air_dry_hours: 8,
}

export interface LearningEvent {
  occurred_at: string
  stage: GameStage
  risk_tag?: string | null
  note?: string | null
}

export interface PlayerState {
  player_id: string
  current_stage: GameStage
  learner_level: LearnerLevel
  selected_materials: Record<string, string>
  parameters: XiangyunshaParameters
  task_theme?: string | null
  target_pattern?: string | null
  history: LearningEvent[]
}

export interface AgentResponse {
  master_reply: string
  risk_tags: string[]
  hint_type: string
  intervention_level: number
  recommended_actions: string[]
  knowledge_used: string[]
  operation_summary: string
  stage: GameStage
  debug: Record<string, unknown>
}

export interface MasterChatRequest {
  player_state: PlayerState
  message?: string | null
  operation_event?: Record<string, unknown> | null
  npc_id?: string
}

export interface ArtworkGenerateRequest {
  player_id: string
  parameters: XiangyunshaParameters
  task_theme?: string | null
  target_pattern?: string | null
}

export interface ArtworkGenerateResponse {
  artwork_id: string
  image_url: string
  original_image_url?: string | null
  prompt_used: string
  negative_prompt: string
  style_tags: string[]
  quality_hint: string
  status: string
  parameters: XiangyunshaParameters
  rule_check_passed: boolean
  risk_tags: string[]
  created_at: string
}

export interface ArtworkSummary {
  artwork_id: string
  task_theme?: string | null
  image_url?: string | null
  status: string
  created_at: string
}

export interface UserStateResponse {
  player_id: string
  nickname: string
  level: string
  created_at: string
  artworks: ArtworkSummary[]
  recent_risk_tags: string[]
}

export interface UserStateUpdate {
  nickname?: string | null
  level?: string | null
}

export interface ScoreBreakdown {
  process_score: number
  pattern_score: number
  color_score: number
  culture_score: number
  progress_score: number
}

export interface Deduction {
  dimension: string
  points: number
  reason: string
  risk_tag?: string | null
}

export interface ScoringReport {
  artwork_id: string
  scores: ScoreBreakdown
  deductions: Deduction[]
  master_feedback: string
  next_task_recommendation?: string | null
}

export function scoreTotal(s: ScoreBreakdown): number {
  return (
    (s.process_score + s.pattern_score + s.color_score + s.culture_score + s.progress_score) / 5
  )
}

// ---------------------------------------------------------------------------
// Event system types (sub-goal 2: AI random events)
// ---------------------------------------------------------------------------

export interface PendingEvent {
  event_id: string
  event_type: string
  npc_id: string | null
  location: string | null
  priority: number
  messages: string[]
  effects: Record<string, unknown>
  created_at: string
}

export interface EventCheckRequest {
  player_state: PlayerState
  current_weather: string | null
  quest_step: number
  arrived_location: string | null
}

export interface EventCheckResponse {
  fired: boolean
  pending_events: PendingEvent[]
  event_messages: string[]
}
