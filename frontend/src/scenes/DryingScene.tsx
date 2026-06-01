import { useState } from 'react'
import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { TimingSpot, type TimingResult } from '../components/TimingSpot'
import { SceneChrome } from '../components/SceneChrome'
import { useNav } from '../app/nav'
import { useGame } from '../app/GameState'
import './station.css'
import './DryingScene.css'

// 晾晒场 — Figma 12:23. 晒莨 station: lay cloth on sun spots, stop at the 恰好 火候.
const SPOTS = [
  { x: 1058, y: 760 },
  { x: 1520, y: 540 },
  { x: 1860, y: 780 },
]
const TARGET = SPOTS.length

const WEATHER_NOTE: Record<string, { text: string; cls: string }> = {
  sunny: { text: '今日晴朗 · 正宜晒莨', cls: 'dry-sunny' },
  cloudy: { text: '今日多云 · 晒制偏慢，火候难掌', cls: 'dry-cloudy' },
  rainy: { text: '今日有雨 · 不宜晒莨，回地图待天晴', cls: 'dry-rainy' },
}

export function DryingScene() {
  const { go } = useNav()
  const { weather, setParams, patchPlayer, addHistory } = useGame()
  const [dried, setDried] = useState<TimingResult[]>([])
  const canDry = weather !== 'rainy'
  const done = dried.length >= TARGET

  const counts: Record<string, number> = { 恰好: 0, 欠晒: 0, 过晒: 0 }
  dried.forEach((r) => {
    counts[r.label]++
  })
  const avg = dried.length ? dried.reduce((s, r) => s + r.q, 0) / dried.length : 0
  const sunDays = Math.round(1 + avg * 4)
  const sunHours = Math.round(4 + avg * 6)

  const masterLine =
    avg >= 0.8 ? '晒得透亮，光泽匀净，好莨绸！'
    : avg >= 0.5 ? '尚可，火候再稳些便好。'
    : counts.过晒 >= counts.欠晒 ? '晒过了头，绸面易脆，下回早些收。'
    : '晒得不足，色浅无光，多晒几日。'

  const confirm = () => {
    setParams({ sun_hours: sunHours, sun_total_days: sunDays, air_dry_hours: 8 })
    patchPlayer({ current_stage: 'parameter' })
    addHistory({ occurred_at: new Date().toISOString(), stage: 'parameter', note: `晒莨 ${sunDays}日` })
    go('map')
  }

  const note = WEATHER_NOTE[weather] ?? WEATHER_NOTE.sunny

  return (
    <SceneRoot bg="/art/bg-drying.png">
      <Abs x={1074} y={120} w={1000} h={150} className="st-title">晒 莨</Abs>
      <Abs x={774} y={278} w={1600} h={66} className="st-sub">铺布暴晒，火候要「恰好」——欠则色浅，过则绸脆</Abs>
      <Abs x={1074} y={372} w={1000} h={70} className={`dry-weather ${note.cls}`}>{note.text}</Abs>

      {SPOTS.map((s, i) => (
        <TimingSpot
          key={i}
          x={s.x}
          y={s.y}
          variant="cloth"
          disabled={!canDry}
          idleHint="铺布晾晒"
          activeHint="停在【恰好】火候!"
          resolve={(v) => ({
            q: Math.max(0, 1 - Math.abs(v - 0.5) / 0.5),
            label: v < 0.38 ? '欠晒' : v > 0.62 ? '过晒' : '恰好',
          })}
          onResult={(r) => setDried((d) => [...d, r])}
        />
      ))}

      <Abs x={2540} y={1360} w={520} h={170} className="st-basket">
        <div className="st-basket-title">晒架</div>
        <div className="st-basket-count"><b>{dried.length}</b> / {TARGET}</div>
      </Abs>

      {done && (
        <Abs x={874} y={500} w={1400} h={740} className="st-result">
          <div className="st-result-title">晒莨 · 完成</div>
          <div className="st-result-line">晒制 {TARGET} 匹（恰好{counts.恰好} 欠{counts.欠晒} 过{counts.过晒}）</div>
          <div className="st-result-line">
            累计晒莨 <b className="st-strong">{sunDays}</b> 日 · 单次 {sunHours} 时
          </div>
          <div className="st-result-master">师父：{masterLine}</div>
          <button className="st-result-btn" onClick={confirm}>收布 · 回坊</button>
        </Abs>
      )}

      <SceneChrome back="map" />
    </SceneRoot>
  )
}
