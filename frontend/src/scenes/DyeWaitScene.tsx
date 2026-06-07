import { useState } from 'react'
import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { SceneChrome } from '../components/SceneChrome'
import { useNav } from '../app/nav'
import { useGame } from '../app/GameState'
import './DyeScene.css'

// 染坊-浸染 — Figma node 76:2183. 香云纱讲究「反复浸染」：每次「浸入莨缸」+1 道，
// 道数写入 dye_cycles，连同所选花纹一起喂给通义万相生图与五维评分。
const MAX_DIPS = 12

export function DyeWaitScene() {
  const { go } = useNav()
  const { player, setParams, patchPlayer, addHistory, completeQuestStep, weather } = useGame()
  const [cycles, setCycles] = useState(0)

  const pattern = player.target_pattern ?? '云纹'
  const weatherHint = weather === 'sunny' ? '晴天光线足，上色匀透！'
    : weather === 'rainy' ? '雨天湿度大，浸染偏慢，道数稍多加两遍。'
    : ''
  const hint =
    cycles === 0
      ? `薯莨汁要反复浸染，点「浸入莨缸」一道道上色。${weatherHint}`
      : cycles < 4
        ? `次数偏少，颜色会发淡——再浸几道。${weatherHint}`
        : cycles <= 8
          ? `上色匀透，这个火候正好。${weatherHint}`
          : '浸得够多了，再浸易过深、发死。'

  const done = () => {
    setParams({ dye_cycles: cycles, dye_water_temp: 25 })
    patchPlayer({ current_stage: 'parameter' })
    addHistory({
      occurred_at: new Date().toISOString(),
      stage: 'parameter',
      note: `浸染 ${cycles} 道 · 花纹「${pattern}」`,
    })
    completeQuestStep(2)
    go('map')
  }

  return (
    <SceneRoot paper paperColor="#EFE9D9">
      <Abs x={97} y={1019} w={655} h={620} className="dye-swatch-wrap">
        <img className="dye-swatch" src="/art/pattern-cloud.png" alt="花纹" />
      </Abs>
      <Abs x={59} y={84} w={3021} h={1611} className="dye-wait-overlay" />

      <Abs x={774} y={300} w={1600} h={140} className="dye-dip-title">浸 染 莨 水</Abs>
      <Abs x={774} y={478} w={1600} h={80} className="dye-dip-pattern">所选花纹 · {pattern}</Abs>

      <Abs x={1024} y={620} w={1100} h={300} className="dye-dip-count">
        <span className="dye-dip-num">{cycles}</span>
        <span className="dye-dip-unit">道</span>
      </Abs>

      <Abs x={874} y={980} w={1400} h={120} className="dye-dip-hint">{hint}</Abs>

      <Abs x={1074} y={1150} w={1000} h={160}>
        <button
          className="dye-dip-btn"
          onClick={() => setCycles((c) => Math.min(c + 1, MAX_DIPS))}
          disabled={cycles >= MAX_DIPS}
        >
          浸入莨缸 +1
        </button>
      </Abs>

      <Abs x={1174} y={1370} w={800} h={150}>
        <button className="dye-dip-done" onClick={done} disabled={cycles === 0}>
          晾起来 · 回坊
        </button>
      </Abs>

      <SceneChrome back="map" />
    </SceneRoot>
  )
}
