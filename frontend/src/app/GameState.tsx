import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { generateArtwork, getScoring } from '../api/client'
import {
  DEFAULT_PARAMETERS,
  scoreTotal,
  type ArtworkGenerateResponse,
  type LearningEvent,
  type PlayerState,
  type ScoringReport,
  type XiangyunshaParameters,
} from '../api/types'

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

interface GameContextValue {
  player: PlayerState
  setParams: (patch: Partial<XiangyunshaParameters>) => void
  patchPlayer: (patch: Partial<PlayerState>) => void
  addHistory: (ev: LearningEvent) => void
  works: StudioWork[]
  addWork: (w: StudioWork) => void
  weather: Weather
  setWeather: (w: Weather) => void
  // AI 成衣闭环：通义万相生图 + 五维评分
  generating: boolean
  genMocked: boolean
  genError: string | null
  currentArtwork: ArtworkGenerateResponse | null
  currentScoring: ScoringReport | null
  finishCraft: () => Promise<void>
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
  const [generating, setGenerating] = useState(false)
  const [genMocked, setGenMocked] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [currentArtwork, setCurrentArtwork] = useState<ArtworkGenerateResponse | null>(null)
  const [currentScoring, setCurrentScoring] = useState<ScoringReport | null>(null)

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

  return (
    <GameContext.Provider
      value={{
        player, setParams, patchPlayer, addHistory,
        works, addWork,
        weather, setWeather,
        generating, genMocked, genError, currentArtwork, currentScoring, finishCraft,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}
