import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  DEFAULT_PARAMETERS,
  type ArtworkSummary,
  type LearningEvent,
  type PlayerState,
  type XiangyunshaParameters,
} from '../api/types'

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

  return (
    <GameContext.Provider
      value={{ player, setParams, patchPlayer, addHistory, artworks, setArtworks, addArtwork, weather, setWeather }}
    >
      {children}
    </GameContext.Provider>
  )
}
