import { SceneRoot } from '../components/SceneRoot'
import { Hotspot } from '../components/Hotspot'
import { SceneChrome } from '../components/SceneChrome'
import './MountainScene.css'

// 山1 — Figma node 65:1198. Three 薯莨 harvest spots on the mountain.
const HARVEST = [
  { x: 612, y: 808 },
  { x: 1289, y: 1297 },
  { x: 2326, y: 692 },
]

export function MountainScene() {
  return (
    <SceneRoot paper paperColor="#EFE9D9" bg="/art/bg-mountain.png">
      {HARVEST.map((s, i) => (
        <Hotspot key={i} x={s.x} y={s.y} size={233} title="采薯莨">
          <span className="harvest-marker" />
        </Hotspot>
      ))}
      <SceneChrome back="map" />
    </SceneRoot>
  )
}
