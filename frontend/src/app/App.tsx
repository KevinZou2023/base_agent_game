import { useEffect, useState, type ComponentType } from 'react'
import { Stage } from '../components/Stage'
import { NavContext, type SceneId } from './nav'
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

const SCENES: Partial<Record<SceneId, ComponentType>> = {
  start: StartScene,
  map: MapScene,
  mapCloudy: MapScene,
  mapRainy: MapScene,
  encyclopedia: BaikeScene,
  warehouse: WarehouseScene,
  space: CreationSpaceScene,
  personal: CreationSpaceScene,
  master: MasterDialogueScene,
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
}

export function App() {
  const [scene, setScene] = useState<SceneId>('start')
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as Window & { __go?: (s: SceneId) => void }).__go = setScene
    }
  }, [])
  const Scene = SCENES[scene] ?? PlaceholderScene
  return (
    <NavContext.Provider value={{ scene, go: setScene }}>
      <Stage>
        <Scene />
      </Stage>
    </NavContext.Provider>
  )
}
