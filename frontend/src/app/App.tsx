import { useEffect, useState, type ComponentType } from 'react'
import { Stage } from '../components/Stage'
import { NavContext, type SceneId } from './nav'
import { GameProvider } from './GameState'
import { checkBackend } from '../api/client'
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

function getInitialScene(): SceneId {
  if (!import.meta.env.DEV) return 'start'
  const scene = new URLSearchParams(window.location.search).get('scene') as SceneId | null
  return scene && SCENES[scene] ? scene : 'start'
}

export function App() {
  const [scene, setScene] = useState<SceneId>(() => getInitialScene())
  useEffect(() => {
    void checkBackend()
    if (import.meta.env.DEV) {
      ;(window as Window & { __go?: (s: SceneId) => void }).__go = setScene
    }
  }, [])
  const Scene = SCENES[scene] ?? PlaceholderScene
  return (
    <GameProvider>
      <NavContext.Provider value={{ scene, go: setScene }}>
        <Stage>
          <Scene />
        </Stage>
      </NavContext.Provider>
    </GameProvider>
  )
}
