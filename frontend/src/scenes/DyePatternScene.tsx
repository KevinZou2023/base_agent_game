import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { SceneChrome } from '../components/SceneChrome'
import { useNav } from '../app/nav'
import { useGame } from '../app/GameState'
import './DyeScene.css'

// 染坊-挑花纹2 — Figma node 76:1679. 挑花纹 → 写入 target_pattern（生图用）→ 去浸染.
const PATTERNS = ['云纹', '福寿纹', '龙凤纹', '缠枝莲', '海水江崖']

export function DyePatternScene() {
  const { go } = useNav()
  const { patchPlayer } = useGame()

  const pick = (name: string) => {
    patchPlayer({ target_pattern: name })
    go('dyeWait')
  }

  return (
    <SceneRoot paper paperColor="#EFE9D9">
      <Abs x={97} y={1019} w={655} h={620} className="dye-swatch-wrap">
        <img className="dye-swatch" src="/art/pattern-cloud.png" alt="当前花纹" />
      </Abs>

      <Abs x={758} y={1018} w={2025} h={90} className="dye-strip-tip">
        挑一个花纹 · 决定成品纹样
      </Abs>

      <Abs x={758} y={1141} w={2025} h={483} className="dye-strip">
        {PATTERNS.map((name) => (
          <button key={name} className="dye-strip-slot" onClick={() => pick(name)}>
            <img src="/art/pattern-cloud.png" alt={name} />
            <span className="dye-strip-name">{name}</span>
          </button>
        ))}
      </Abs>

      <SceneChrome back="map" />
    </SceneRoot>
  )
}
