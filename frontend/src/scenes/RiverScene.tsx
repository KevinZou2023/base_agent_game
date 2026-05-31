import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { Hotspot } from '../components/Hotspot'
import { SceneChrome } from '../components/SceneChrome'
import './RiverScene.css'

// 河-捞河泥 — Figma node 45:261. Five mud-scoop spots + a 过滤 button.
const MUD = [
  { x: 480, y: 830 },
  { x: 1062, y: 895 },
  { x: 1560, y: 684 },
  { x: 2124, y: 905 },
  { x: 2615, y: 737 },
]

export function RiverScene() {
  return (
    <SceneRoot bg="/art/bg-river.png">
      {MUD.map((m, i) => (
        <Hotspot key={i} x={m.x} y={m.y} size={117} title="捞河泥" />
      ))}
      <Abs x={839} y={411} w={301} h={184} className="river-filter">
        过滤
      </Abs>
      <SceneChrome back="map" />
    </SceneRoot>
  )
}
