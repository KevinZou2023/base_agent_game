import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { checkEvents, generateArtwork, getScoring, markGameStart } from '../api/client'
import {
  DEFAULT_PARAMETERS,
  scoreTotal,
  type ArtworkGenerateResponse,
  type LearningEvent,
  type PendingEvent,
  type PlayerState,
  type ScoringReport,
  type XiangyunshaParameters,
} from '../api/types'
import { resetQuestStep, saveQuestStep } from '../app/quest'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const WORKS_KEY = 'liangzuo.works'

/** A finished 香云纱 the player generated — drives 成品库 / 仓库. */
export interface StudioWork {
  artwork_id: string
  image_url: string
  pattern: string
  score: number
  created_at: string
  mocked: boolean
}

function loadWorks(): StudioWork[] {
  try {
    const raw = localStorage.getItem(WORKS_KEY)
    const parsed = raw ? (JSON.parse(raw) as StudioWork[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const PID_KEY = 'liangzuo.player_id'
const PS_KEY = 'liangzuo.player_state'
const COMPLETED_KEY = 'liangzuo.completed_steps'

function loadCompletedSteps(): Set<number> {
  try {
    const raw = localStorage.getItem(COMPLETED_KEY)
    if (!raw) return new Set<number>()
    const arr = JSON.parse(raw) as number[]
    return new Set(Array.isArray(arr) ? arr : [])
  } catch { return new Set<number>() }
}
function saveCompletedSteps(s: Set<number>) {
  localStorage.setItem(COMPLETED_KEY, JSON.stringify([...s]))
}

function loadPlayerId(): string {
  let id = localStorage.getItem(PID_KEY)
  if (!id) {
    id = 'player_' + Math.random().toString(36).slice(2, 10)
    localStorage.setItem(PID_KEY, id)
  }
  return id
}

function loadPlayerState(playerId: string): PlayerState {
  const raw = localStorage.getItem(PS_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PlayerState
      if (parsed.player_id === playerId) return parsed
    } catch {
      /* ignore corrupt state */
    }
  }
  return {
    player_id: playerId,
    current_stage: 'task',
    learner_level: 'beginner',
    selected_materials: {},
    parameters: { ...DEFAULT_PARAMETERS },
    task_theme: null,
    target_pattern: null,
    history: [],
  }
}

export type Weather = 'sunny' | 'cloudy' | 'rainy'

// 天气惯性转移概率表
const WEATHER_PROBS: Record<Weather, { sunny: number; cloudy: number; rainy: number }> = {
  sunny:  { sunny: 0.60, cloudy: 0.30, rainy: 0.10 },
  cloudy: { sunny: 0.40, cloudy: 0.30, rainy: 0.30 },
  rainy:  { sunny: 0.15, cloudy: 0.50, rainy: 0.35 },
}
function nextWeather(current: Weather): Weather {
  const probs = WEATHER_PROBS[current]
  const r = Math.random()
  let acc = 0
  for (const [w, p] of Object.entries(probs) as [Weather, number][]) {
    acc += p
    if (r < acc) return w
  }
  return current
}

interface GameContextValue {
  player: PlayerState
  setParams: (patch: Partial<XiangyunshaParameters>) => void
  patchPlayer: (patch: Partial<PlayerState>) => void
  addHistory: (ev: LearningEvent) => void
  works: StudioWork[]
  addWork: (w: StudioWork) => void
  weather: Weather
  setWeather: (w: Weather) => void
  gameTime: number // 游戏内分钟数，从0开始，独立流动
  // AI 成衣闭环：通义万相生图 + 五维评分
  generating: boolean
  genMocked: boolean
  genError: string | null
  currentArtwork: ArtworkGenerateResponse | null
  currentScoring: ScoringReport | null
  finishCraft: () => Promise<void>
  //事件系统
  pendingEvents: PendingEvent[]
  questStep: number
  setArrivedLocation: (loc: string | null) => void
  // 进度管理
  resetProgress: () => void
  clearWorks: () => void
  // 任务步骤完成
  completedSteps: Set<number>
  completeQuestStep: (step: number) => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within <GameProvider>')
  return ctx
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<PlayerState>(() => loadPlayerState(loadPlayerId()))
  const [works, setWorks] = useState<StudioWork[]>(loadWorks)
  const [weather, setWeather] = useState<Weather>('sunny')
  const [gameTime, setGameTime] = useState<number>(() => 10 * 60) // 游戏内分钟，从早上10点开始
  const [generating, setGenerating] = useState(false)
  const [genMocked, setGenMocked] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [currentArtwork, setCurrentArtwork] = useState<ArtworkGenerateResponse | null>(null)
  const [currentScoring, setCurrentScoring] = useState<ScoringReport | null>(null)
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([])
  const [questStep, _setQuestStep] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('liangzuo.quest_step')
      return raw !== null ? JSON.parse(raw) : -1
    } catch { return -1 }
  })
  const [arrivedLocation, setArrivedLocation] = useState<string | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(loadCompletedSteps)

  const completeQuestStep = useCallback((step: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev)
      next.add(step)
      saveCompletedSteps(next)
      return next
    })
    saveQuestStep(step + 1)
    _setQuestStep(step + 1)
  }, [])

  // Always read the freshest player state inside the async craft flow.
  const playerRef = useRef(player)
  playerRef.current = player

  useEffect(() => {
    localStorage.setItem(PS_KEY, JSON.stringify(player))
  }, [player])

  useEffect(() => {
    localStorage.setItem(WORKS_KEY, JSON.stringify(works))
  }, [works])

  const setParams = useCallback((patch: Partial<XiangyunshaParameters>) => {
    setPlayer((p) => ({ ...p, parameters: { ...p.parameters, ...patch } }))
  }, [])

  const patchPlayer = useCallback((patch: Partial<PlayerState>) => {
    setPlayer((p) => ({ ...p, ...patch }))
  }, [])

  const addHistory = useCallback((ev: LearningEvent) => {
    setPlayer((p) => ({ ...p, history: [...p.history, ev] }))
  }, [])

  const addWork = useCallback((w: StudioWork) => {
    setWorks((list) => [w, ...list].slice(0, 60))
  }, [])

  /** 清空所有进度（保留作品列表和背包）。 */
  const resetProgress = useCallback(() => {
    resetQuestStep()
    localStorage.removeItem(PS_KEY)
    localStorage.removeItem(COMPLETED_KEY)
    const newPlayer = loadPlayerState(loadPlayerId())
    setPlayer(newPlayer)
    setPendingEvents([])
    setCompletedSteps(new Set())
    markGameStart().catch(() => {/* ignore */})
  }, [])

  /** 清空成品库（保留进度）。 */
  const clearWorks = useCallback(() => {
    localStorage.removeItem(WORKS_KEY)
    setWorks([])
  }, [])

  // 完成制作 → 通义万相按玩家参数生图 → 五维评分。client 失败时会回退 mock，
  // 所以正常不会 throw；floor 一个最短时长，让「成衣中」节奏在离线 mock 下也站得住。
  const finishCraft = useCallback(async () => {
    const p = playerRef.current
    setGenerating(true)
    setGenError(null)
    setCurrentArtwork(null)
    setCurrentScoring(null)
    try {
      const [{ data: art, mocked }] = await Promise.all([
        generateArtwork({
          player_id: p.player_id,
          parameters: p.parameters,
          task_theme: p.task_theme ?? null,
          target_pattern: p.target_pattern ?? '云纹',
        }),
        sleep(1600),
      ])
      setGenMocked(mocked)
      setCurrentArtwork(art)
      const { data: score } = await getScoring(art.artwork_id)
      setCurrentScoring(score)
      addWork({
        artwork_id: art.artwork_id,
        image_url: art.image_url,
        pattern: p.target_pattern ?? '云纹',
        score: Math.round(scoreTotal(score.scores)),
        created_at: art.created_at,
        mocked,
      })
    } catch (e) {
      setGenError(e instanceof Error ? e.message : '成衣失败，请回工坊重试')
    } finally {
      setGenerating(false)
    }
  }, [addWork])

  // Mark game start on mount (for event elapsed-time tracking)
  useEffect(() => {
    markGameStart().catch(() => {/* ignore if offline */})
  }, [])

  // Event polling: check every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { data } = await checkEvents({
          player_state: playerRef.current,
          current_weather: weather,
          quest_step: questStep,
          arrived_location: arrivedLocation,
        })
        if (data.fired && data.pending_events.length > 0) {
          //立即设置并清空：pendingEvents 仅用于本次渲染，不累积
          setPendingEvents(data.pending_events as PendingEvent[])
          setTimeout(() => setPendingEvents([]), 0)
        }
      } catch { /* offline: silent */ }
    }, 30_000)
    return () => clearInterval(interval)
  }, [weather, questStep, arrivedLocation])

  // 游戏时钟：每 2 秒推进 1 游戏分钟（约 30 倍速）
  useEffect(() => {
    const interval = setInterval(() => setGameTime((m) => m + 1), 2_000)
    return () => clearInterval(interval)
  }, [])

  // 天气随机变化：每 3 分钟按惯性概率转移天气
  useEffect(() => {
    const interval = setInterval(() => {
      const next = nextWeather(weather)
      if (next !== weather) setWeather(next)
    }, 180_000)
    return () => clearInterval(interval)
  }, [weather])

  // Keep arrivedLocation in sync with questStep changes
  useEffect(() => {
    if (questStep >= 0) {
      setArrivedLocation(null) // reset after movement triggered
    }
  }, [questStep])

  return (
    <GameContext.Provider
      value={{
        player, setParams, patchPlayer, addHistory,
        works, addWork,
        weather, setWeather, gameTime,
        generating, genMocked, genError, currentArtwork, currentScoring, finishCraft,
        pendingEvents, questStep, setArrivedLocation,
        resetProgress, clearWorks,
        completedSteps, completeQuestStep,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}
