import { SceneRoot } from '../components/SceneRoot'
import { Hotspot } from '../components/Hotspot'
import { SceneChrome } from '../components/SceneChrome'

// 晾晒场 — Figma node 12:23. Sun-drying field with seven 晒莨 spots.
const SPOTS = [
  { x: 1758, y: 951 },
  { x: 1509, y: 1119 },
  { x: 1291, y: 944 },
  { x: 1058, y: 747 },
  { x: 1328, y: 579 },
  { x: 1559, y: 445 },
  { x: 1788, y: 618 },
]

export function DryingScene() {
  return (
    <SceneRoot bg="/art/bg-drying.png">
      {SPOTS.map((s, i) => (
        <Hotspot key={i} x={s.x} y={s.y} size={117} title="晒莨" />
      ))}
      <SceneChrome back="map" />
    </SceneRoot>
  )
}
