import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { generateArtwork, getScoring } from '../api/client'
import {
  DEFAULT_PARAMETERS,
  type ArtworkGenerateResponse,
  type ArtworkSummary,
  type LearningEvent,
  type PlayerState,
  type ScoringReport,
  type XiangyunshaParameters,
} from '../api/types'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

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
  artworks: ArtworkSummary[]
  setArtworks: (a: ArtworkSummary[]) => void
  addArtwork: (a: ArtworkSummary) => void
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
  const [artworks, setArtworks] = useState<ArtworkSummary[]>([])
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

  const setParams = useCallback((patch: Partial<XiangyunshaParameters>) => {
    setPlayer((p) => ({ ...p, parameters: { ...p.parameters, ...patch } }))
  }, [])

  const patchPlayer = useCallback((patch: Partial<PlayerState>) => {
    setPlayer((p) => ({ ...p, ...patch }))
  }, [])

  const addHistory = useCallback((ev: LearningEvent) => {
    setPlayer((p) => ({ ...p, history: [...p.history, ev] }))
  }, [])

  const addArtwork = useCallback((a: ArtworkSummary) => {
    setArtworks((list) => [a, ...list])
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
      addArtwork({
        artwork_id: art.artwork_id,
        task_theme: p.task_theme ?? null,
        image_url: art.image_url,
        status: art.status,
        created_at: art.created_at,
      })
      const { data: score } = await getScoring(art.artwork_id)
      setCurrentScoring(score)
    } catch (e) {
      setGenError(e instanceof Error ? e.message : '成衣失败，请回工坊重试')
    } finally {
      setGenerating(false)
    }
  }, [addArtwork])

  return (
    <GameContext.Provider
      value={{
        player, setParams, patchPlayer, addHistory,
        artworks, setArtworks, addArtwork,
        weather, setWeather,
        generating, genMocked, genError, currentArtwork, currentScoring, finishCraft,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}
