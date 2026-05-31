import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { SceneChrome } from '../components/SceneChrome'
import { useNav } from '../app/nav'
import './DyeScene.css'

// 染坊-挑花纹2 — Figma node 76:1679. Pattern picker open (bottom strip).
export function DyePatternScene() {
  const { go } = useNav()
  return (
    <SceneRoot paper paperColor="#EFE9D9">
      <Abs x={97} y={1019} w={655} h={620} className="dye-swatch-wrap">
        <img className="dye-swatch" src="/art/pattern-cloud.png" alt="当前花纹" />
      </Abs>

      <Abs x={758} y={1141} w={2025} h={483} className="dye-strip">
        {[0, 1, 2, 3, 4].map((i) => (
          <button key={i} className="dye-strip-slot" onClick={() => go('dyeWait')}>
            <img src="/art/pattern-cloud.png" alt={`花纹 ${i + 1}`} />
          </button>
        ))}
      </Abs>

      <SceneChrome back="map" />
    </SceneRoot>
  )
}
