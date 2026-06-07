import { Component, useEffect, useState, type ReactNode, type ComponentType } from 'react'
import { AudioManager } from '../components/AudioManager'
import { SFXManager } from '../components/SFXManager'
import { Stage } from '../components/Stage'
import { NavContext, type SceneId } from './nav'
import { GameProvider, useGame } from './GameState'
import { checkBackend } from '../api/client'
import { EventToast } from '../components/EventToast'
import { StartScene } from '../scenes/StartScene'
import { MapScene } from '../scenes/MapScene'
import { BaikeScene } from '../scenes/BaikeScene'
import { WarehouseScene } from '../scenes/WarehouseScene'
import { CreationSpaceScene } from '../scenes/CreationSpaceScene'
import { MasterDialogueScene } from '../scenes/MasterDialogueScene'
import { VillageScene } from '../scenes/VillageScene'
import { RiverScene } from '../scenes/RiverScene'
import { DyeScene } from '../scenes/DyeScene'
import { DryingScene } from '../scenes/DryingScene'
import { MountainScene } from '../scenes/MountainScene'
import { VillagerHomeScene } from '../scenes/VillagerHomeScene'
import { EventScene } from '../scenes/EventScene'
import { DyePatternScene } from '../scenes/DyePatternScene'
import { DyeWaitScene } from '../scenes/DyeWaitScene'
import { IntroScene } from '../scenes/IntroScene'
import { SettingsScene } from '../scenes/SettingsScene'
import { PlaceholderScene } from '../scenes/PlaceholderScene'
import { Showcase3DScene } from '../scenes/Showcase3DScene'
import { WorkshopScene } from '../scenes/WorkshopScene'

const SCENES: Partial<Record<SceneId, ComponentType>> = {
  start: StartScene,
  map: MapScene,
  mapCloudy: MapScene,
  mapRainy: MapScene,
  encyclopedia: BaikeScene,
  warehouse: WarehouseScene,
  space: CreationSpaceScene,
  personal: CreationSpaceScene,
  master: VillagerHomeScene, // 师父的家 = 家场景（立绘+菜单+百科书）
  masterChat: MasterDialogueScene, // 师父对话 = 聊天页
  village: VillageScene,
  river: RiverScene,
  dye: DyeScene,
  drying: DryingScene,
  mountain: MountainScene,
  ahua: VillagerHomeScene,
  acai: VillagerHomeScene,
  popo: VillagerHomeScene,
  event: EventScene,
  dyePattern: DyePatternScene,
  dyeWait: DyeWaitScene,
  intro: IntroScene,
  settings: SettingsScene,
  showcase3d: Showcase3DScene,
  weaving: WorkshopScene, // 织布坊 → 第一人称 3D 工坊
}

// Error Boundary — 防止 EventToast 渲染崩溃导致整页黑屏
class EventBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  render() { return this.state.hasError ? null : this.props.children }
}

function AppInner() {
  const { pendingEvents } = useGame()
  const [scene, setScene] = useState<SceneId>('start')
  useEffect(() => {
    void checkBackend()
    if (import.meta.env.DEV) {
      ;(window as Window & { __go?: (s: SceneId) => void }).__go = setScene
    }
  }, [])
  const Scene = SCENES[scene] ?? PlaceholderScene

  return (
    <>
      <AudioManager />
      <SFXManager />
      <NavContext.Provider value={{ scene, go: setScene }}>
        <Stage>
          <Scene />
        </Stage>
      </NavContext.Provider>
      <EventBoundary>
        {pendingEvents.map((ev) => {
          const npcNames: Record<string, string> = { granny: '阿婆', yeye: '老爷爷', ahua: '阿花' }
          const npcSprites: Record<string, string> = {
            granny: '/art/npc_popo.png',
            yeye: '/art/npc_yeye.png',
            ahua: '/art/villager-ahua.png',
          }
          return (
            <EventToast
              key={ev.event_id}
              eventId={ev.event_id}
              npcName={npcNames[ev.npc_id ?? ''] ?? ev.npc_id ?? '???'}
              npcSprite={npcSprites[ev.npc_id ?? '']}
              messages={ev.messages}
              location={ev.location}
            />
          )
        })}
      </EventBoundary>
    </>
  )
}

export function App() {
  return (
    <GameProvider>
      <AppInner />
    </GameProvider>
  )
}
