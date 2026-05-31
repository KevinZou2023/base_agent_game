import { createContext, useContext } from 'react'

/** All scenes reachable in the game. Unbuilt ones route to a placeholder. */
export type SceneId =
  | 'start'
  | 'intro'
  | 'personal'
  | 'map'
  | 'encyclopedia'
  | 'warehouse'
  | 'space'
  | 'settings'
  | 'village'
  | 'river'
  | 'master'
  | 'weaving'
  | 'dye'
  | 'drying'
  | 'mountain'
  | 'ahua'
  | 'acai'
  | 'popo'
  | 'event'
  | 'dyePattern'
  | 'dyeWait'
  | 'mapCloudy'
  | 'mapRainy'

export interface Nav {
  scene: SceneId
  go: (s: SceneId) => void
}

export const NavContext = createContext<Nav | null>(null)

export function useNav(): Nav {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav must be used within <NavContext.Provider>')
  return ctx
}
