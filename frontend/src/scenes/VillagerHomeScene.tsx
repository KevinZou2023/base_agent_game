import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { SceneChrome } from '../components/SceneChrome'
import { useNav, type SceneId } from '../app/nav'
import './VillagerHomeScene.css'

// 村民的家 — Figma nodes 28:1284 (阿花) / 28:1803 (阿才) / 28:2030 (老太太).
// Room background + villager portrait + a 2x2 action menu.
const VILLAGERS: Record<string, { name: string; portrait: string; px: number }> = {
  ahua: { name: '阿花', portrait: '/art/master-portrait.png', px: 1179 },
  acai: { name: '阿才', portrait: '/art/master-portrait.png', px: 1031 },
  popo: { name: '阿婆', portrait: '/art/villager-popo.png', px: 1144 },
}

interface Action {
  label: string
  cx: number
  cy: number
  go?: SceneId
}
const ACTIONS: Action[] = [
  { label: '对话', cx: 2159, cy: 502, go: 'event' },
  { label: '邀请', cx: 2565, cy: 502 },
  { label: '送礼', cx: 2159, cy: 912 },
  { label: '情报', cx: 2565, cy: 912 },
]

export function VillagerHomeScene() {
  const { scene, go } = useNav()
  const v = VILLAGERS[scene] ?? VILLAGERS.ahua
  return (
    <SceneRoot bg="/art/master-bg.png">
      <Abs x={v.px} y={-351} w={920} h={2876}>
        <img className="vh-portrait" src={v.portrait} alt={v.name} />
      </Abs>

      <Abs x={2029} y={409} w={1007} h={900} className="vh-panel" />
      {ACTIONS.map((a) => (
        <Abs
          key={a.label}
          x={a.cx}
          y={a.cy}
          w={301}
          h={301}
          className="vh-action"
          onClick={() => a.go && go(a.go)}
        >
          {a.label}
        </Abs>
      ))}

      <SceneChrome back="village" />
    </SceneRoot>
  )
}
