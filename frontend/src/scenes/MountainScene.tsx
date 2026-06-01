import { useState } from 'react'
import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { TimingSpot, type TimingResult } from '../components/TimingSpot'
import { SceneChrome } from '../components/SceneChrome'
import { useNav } from '../app/nav'
import { useGame } from '../app/GameState'
import './MountainScene.css'

// 山1 — Figma 65:1198. 采薯莨 station (timing harvest → 浸染浓度).
const SPOTS = [
  { x: 612, y: 808 },
  { x: 1289, y: 1297 },
  { x: 2326, y: 692 },
]
const TARGET = SPOTS.length

// Figma 山1 layers the same mountain image 3× (different offsets/sizes) to fill the frame.
const MTN_LAYERS = [
  { x: 459, y: 0, w: 2622, h: 2326 },
  { x: 25, y: 312, w: 2745, h: 2435 },
  { x: 149, y: 86, w: 3093, h: 2744 },
]

export function MountainScene() {
  const { go } = useNav()
  const { setParams, patchPlayer, addHistory } = useGame()
  const [picked, setPicked] = useState<TimingResult[]>([])
  const done = picked.length >= TARGET

  const onHarvest = (r: TimingResult) => setPicked((p) => [...p, r])

  const counts: Record<string, number> = { 大: 0, 中: 0, 小: 0 }
  picked.forEach((r) => {
    counts[r.label[0]]++
  })
  const avg = picked.length ? picked.reduce((s, r) => s + r.q, 0) / picked.length : 0
  const concentration = Math.round((0.45 + avg * 0.5) * 100) / 100

  const masterLine =
    concentration >= 0.8
      ? '薯莨饱满，汁色定然浓亮，下缸去罢。'
      : concentration >= 0.6
        ? '尚可，浸染时多浸两道便好。'
        : '薯莨偏嫩，色会浅，回头多采些饱满的。'

  const confirm = () => {
    setParams({ shuliang_concentration: concentration })
    patchPlayer({ current_stage: 'material', selected_materials: { 薯莨: String(picked.length) } })
    addHistory({ occurred_at: new Date().toISOString(), stage: 'material', note: `采薯莨 ×${picked.length}` })
    go('map')
  }

  return (
    <SceneRoot paper paperColor="#e6ece1">
      {MTN_LAYERS.map((m, i) => (
        <Abs key={`mtn${i}`} x={m.x} y={m.y} w={m.w} h={m.h} className="mtn-layer">
          <img src="/art/bg-mountain.png" alt="" />
        </Abs>
      ))}
      <Abs x={1074} y={140} w={1000} h={150} className="hv-title">采 薯 莨</Abs>
      <Abs x={874} y={300} w={1400} h={66} className="hv-sub">点击薯莨藤挖掘，趁「正熟」时起锄</Abs>

      {SPOTS.map((s, i) => (
        <TimingSpot
          key={i}
          x={s.x}
          y={s.y}
          variant="tuber"
          idleHint="点击挖掘"
          activeHint="趁【正熟】起锄!"
          resolve={(v) => {
            const d = Math.abs(v - 0.5)
            return {
              q: Math.max(0, 1 - d / 0.5),
              label: d < 0.12 ? '大薯莨' : d < 0.3 ? '中薯莨' : '小薯莨',
            }
          }}
          onResult={onHarvest}
        />
      ))}

      <Abs x={2520} y={1330} w={540} h={280} className="hv-basket">
        <div className="hv-basket-title">背篓</div>
        <div className="hv-basket-count">
          <b>{picked.length}</b> / {TARGET}
        </div>
        <div className="hv-basket-tubers">
          {picked.map((r, i) => (
            <span key={i} className={`hv-tuber hv-tuber-${r.label[0]}`} />
          ))}
        </div>
      </Abs>

      {done && (
        <Abs x={874} y={520} w={1400} h={720} className="hv-result">
          <div className="hv-result-title">采薯莨 · 完成</div>
          <div className="hv-result-line">
            采得 薯莨 ×{picked.length}（大{counts.大} 中{counts.中} 小{counts.小}）
          </div>
          <div className="hv-result-line">
            汁液浓度 <b className="hv-strong">{Math.round(concentration * 100)}%</b>
          </div>
          <div className="hv-result-master">师父：{masterLine}</div>
          <button className="hv-result-btn" onClick={confirm}>
            收入背篓 · 下山
          </button>
        </Abs>
      )}

      <SceneChrome back="map" />
    </SceneRoot>
  )
}
