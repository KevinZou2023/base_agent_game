/**
 * Typed API client for the FastAPI backend.
 * Strategy: try the real endpoint; on any failure fall back to mock data so the
 * frontend always runs. A /health probe drives an online/offline status badge.
 */
import type {
  AgentResponse,
  ArtworkGenerateRequest,
  ArtworkGenerateResponse,
  MasterChatRequest,
  ScoringReport,
  UserStateResponse,
  UserStateUpdate,
} from './types'

const BASE = '/api/v1'
const TIMEOUT_MS = 8000

export type BackendStatus = 'unknown' | 'online' | 'offline'
let status: BackendStatus = 'unknown'
const listeners = new Set<(s: BackendStatus) => void>()

export function getBackendStatus(): BackendStatus {
  return status
}
export function onBackendStatus(fn: (s: BackendStatus) => void): () => void {
  listeners.add(fn)
  fn(status)
  return () => listeners.delete(fn)
}
function setStatus(s: BackendStatus) {
  if (s !== status) {
    status = s
    listeners.forEach((l) => l(s))
  }
}

/** Probe the backend; updates status. Safe to call on app start. */
export async function checkBackend(): Promise<boolean> {
  try {
    const res = await fetch('/health', { signal: AbortSignal.timeout(3000) })
    setStatus(res.ok ? 'online' : 'offline')
    return res.ok
  } catch {
    setStatus('offline')
    return false
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  setStatus('online')
  return (await res.json()) as T
}

/** Whether the last/most-recent call used mock data. */
export interface Result<T> {
  data: T
  mocked: boolean
}

export async function masterChat(req: MasterChatRequest): Promise<Result<AgentResponse>> {
  try {
    return { data: await http<AgentResponse>('/master/chat', { method: 'POST', body: JSON.stringify(req) }), mocked: false }
  } catch {
    setStatus('offline')
    return { data: mockMasterChat(req), mocked: true }
  }
}

export async function generateArtwork(
  req: ArtworkGenerateRequest,
): Promise<Result<ArtworkGenerateResponse>> {
  try {
    return { data: await http<ArtworkGenerateResponse>('/artwork/generate', { method: 'POST', body: JSON.stringify(req) }), mocked: false }
  } catch {
    setStatus('offline')
    return { data: mockGenerate(req), mocked: true }
  }
}

export async function getScoring(artworkId: string): Promise<Result<ScoringReport>> {
  try {
    return { data: await http<ScoringReport>(`/scoring/${artworkId}`), mocked: false }
  } catch {
    setStatus('offline')
    return { data: mockScoring(artworkId), mocked: true }
  }
}

export async function getUserState(playerId: string): Promise<Result<UserStateResponse>> {
  try {
    return { data: await http<UserStateResponse>(`/user/${playerId}/state`), mocked: false }
  } catch {
    setStatus('offline')
    return { data: mockUserState(playerId), mocked: true }
  }
}

export async function updateUserState(
  playerId: string,
  body: UserStateUpdate,
): Promise<Result<UserStateResponse>> {
  try {
    return { data: await http<UserStateResponse>(`/user/${playerId}/state`, { method: 'PUT', body: JSON.stringify(body) }), mocked: false }
  } catch {
    setStatus('offline')
    const s = mockUserState(playerId)
    return { data: { ...s, nickname: body.nickname ?? s.nickname, level: body.level ?? s.level }, mocked: true }
  }
}

// ---------------------------------------------------------------------------
// Mock data (used when the backend is unreachable)
// ---------------------------------------------------------------------------

function mockMasterChat(req: MasterChatRequest): AgentResponse {
  const p = req.player_state.parameters
  const risks: string[] = []
  if (p.sun_total_days < 2) risks.push('晒莨不足')
  if (p.dye_cycles < 4) risks.push('浸染次数偏少')
  const msg = req.message?.trim()
  const reply = msg
    ? `（离线示范）你问「${msg}」。香云纱讲究薯莨反复浸染、烈日暴晒、河泥过乌——慢工出细活。${risks.length ? '眼下' + risks.join('、') + '，成色会偏淡。' : '你这参数稳妥，可以下缸了。'}`
    : '（离线示范）后生，香云纱三分料七分晒，莫急。先把薯莨汁刷匀了。'
  return {
    master_reply: reply,
    risk_tags: risks,
    hint_type: risks.length ? 'warn' : 'encourage',
    intervention_level: risks.length ? 2 : 1,
    recommended_actions: risks.length ? ['增加晒莨天数', '提高浸染次数'] : ['保持当前节奏'],
    knowledge_used: ['craft_step:shuliang_dye', 'failure_case:晒莨不足'],
    operation_summary: '离线 mock 反馈',
    stage: req.player_state.current_stage,
    debug: { mocked: true },
  }
}

const MOCK_CLOTHS = ['/art/cloth-brown.png', '/art/cloth-tan.png', '/art/cloth-fine.png']

function mockGenerate(req: ArtworkGenerateRequest): ArtworkGenerateResponse {
  const id = 'art_mock_' + Math.random().toString(36).slice(2, 8)
  const img = MOCK_CLOTHS[Math.floor(Math.random() * MOCK_CLOTHS.length)]
  return {
    artwork_id: id,
    image_url: img,
    original_image_url: null,
    prompt_used: `香云纱 ${req.target_pattern ?? '云纹'}，红褐底黑亮面，浸染${req.parameters.dye_cycles}次`,
    negative_prompt: '现代元素, 文字, 水印',
    style_tags: ['xiangyunsha', 'ink', '红褐'],
    quality_hint: 'high',
    status: 'done',
    parameters: req.parameters,
    rule_check_passed: true,
    risk_tags: [],
    created_at: new Date().toISOString(),
  }
}

function mockScoring(artworkId: string): ScoringReport {
  const r = (base: number) => Math.round(base + Math.random() * 12)
  return {
    artwork_id: artworkId,
    scores: {
      process_score: r(78),
      pattern_score: r(80),
      color_score: r(75),
      culture_score: r(82),
      progress_score: r(70),
    },
    deductions: [{ dimension: '色彩协调度', points: 6, reason: '黑亮面不够油亮', risk_tag: '过乌不足' }],
    master_feedback: '（离线示范）底色红褐到位，黑亮面再油润些就更地道了。下回过乌多刷一遍。',
    next_task_recommendation: '尝试「端午 · 红褐黑亮方巾」',
  }
}

function mockUserState(playerId: string): UserStateResponse {
  const now = new Date().toISOString()
  return {
    player_id: playerId,
    nickname: '学徒',
    level: 'beginner',
    created_at: now,
    artworks: [
      { artwork_id: 'art_seed_1', task_theme: '初染方巾', image_url: '/art/cloth-tan.png', status: 'done', created_at: now },
      { artwork_id: 'art_seed_2', task_theme: '云纹围巾', image_url: '/art/cloth-brown.png', status: 'done', created_at: now },
    ],
    recent_risk_tags: ['晒莨不足'],
  }
}
