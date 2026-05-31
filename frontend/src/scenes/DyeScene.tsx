import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { SceneChrome } from '../components/SceneChrome'
import { useNav } from '../app/nav'
import './DyeScene.css'

// 染坊-挑花纹 — Figma node 76:1441. Pattern-selection workspace (生图入口).
export function DyeScene() {
  const { go } = useNav()
  return (
    <SceneRoot paper paperColor="#EFE9D9">
      <Abs
        x={97}
        y={1019}
        w={655}
        h={620}
        className="dye-swatch-wrap"
        onClick={() => go('dyePattern')}
      >
        <img className="dye-swatch" src="/art/pattern-cloud.png" alt="花纹" />
      </Abs>
      <SceneChrome back="map" />
    </SceneRoot>
  )
}
