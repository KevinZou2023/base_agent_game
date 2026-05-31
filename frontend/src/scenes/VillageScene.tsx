import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { SceneChrome } from '../components/SceneChrome'
import { useNav, type SceneId } from '../app/nav'
import './VillageScene.css'

// 村庄-选项 — Figma node 12:1591. Choose which villager to visit.
const HOUSES: { label: string; y: number; to: SceneId }[] = [
  { label: '阿花的家（好感21）', y: 329, to: 'ahua' },
  { label: '阿才的家（好感-2，对方可能不见你）', y: 578, to: 'acai' },
  { label: '阿婆的家（好感71）', y: 827, to: 'popo' },
]

export function VillageScene() {
  const { go } = useNav()
  return (
    <SceneRoot paper paperColor="#EFE9D9" bg="/art/bg-village.png">
      {HOUSES.map((h) => (
        <Abs
          key={h.label}
          x={1076}
          y={h.y}
          w={1051}
          h={182}
          className="village-plaque"
          onClick={() => go(h.to)}
        >
          {h.label}
        </Abs>
      ))}
      <Abs x={1076} y={1270} w={1051} h={110} className="village-prompt">
        现在去哪里呢
      </Abs>
      <SceneChrome back="map" />
    </SceneRoot>
  )
}
