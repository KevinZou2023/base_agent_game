import { useState } from 'react'
import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { TimingSpot, type TimingResult } from '../components/TimingSpot'
import { SceneChrome } from '../components/SceneChrome'
import { useNav } from '../app/nav'
import { useGame } from '../app/GameState'
import './station.css'
import './RiverScene.css'

// 河-捞河泥 — Figma 45:261. 捞泥 (tap 5) → 过滤 (timing) → 过乌泥料.
const MUD = [
  { x: 480, y: 830 },
  { x: 1062, y: 895 },
  { x: 1560, y: 684 },
  { x: 2124, y: 905 },
  { x: 2615, y: 737 },
]

function MudSpot({ x, y, onCollect }: { x: number; y: number; onCollect: () => void }) {
  const [taken, setTaken] = useState(false)
  if (taken) return null
  return (
    <Abs x={x} y={y} w={117} h={117} className="river-mud" onClick={() => { setTaken(true); onCollect() }}>
      <div className="river-mud-glow" />
    </Abs>
  )
}

export function RiverScene() {
  const { go } = useNav()
  const { setParams, patchPlayer, addHistory } = useGame()
  const [collected, setCollected] = useState(0)
  const [filtered, setFiltered] = useState<TimingResult | null>(null)

  const allCollected = collected >= MUD.length
  const purity = filtered ? Math.round(filtered.q * 100) : 0
  const thickness = filtered ? Math.round((0.4 + filtered.q * 0.4) * 100) / 100 : 0
  const masterLine =
    filtered && filtered.q >= 0.8 ? '泥细如膏，过乌定然乌黑发亮。'
    : filtered && filtered.q >= 0.5 ? '尚可，再多筛两遍更细。'
    : '泥太粗，过乌易花，回头细筛。'

  const confirm = () => {
    setParams({ wu_mud_thickness: thickness, wu_apply_count: 2 })
    patchPlayer({ current_stage: 'parameter', selected_materials: { 河泥: String(MUD.length) } })
    addHistory({ occurred_at: new Date().toISOString(), stage: 'parameter', note: `过滤河泥 纯度${purity}%` })
    go('map')
  }

  return (
    <SceneRoot bg="/art/bg-river.png">
      <Abs x={1074} y={120} w={1000} h={150} className="st-title">捞 河 泥</Abs>
      <Abs x={774} y={278} w={1600} h={66} className="st-sub">
        {allCollected ? '河泥已满，点击中央筛盘过滤——停在「最细」处' : '点击河面的河泥捞取'}
      </Abs>

      {!allCollected &&
        MUD.map((m, i) => <MudSpot key={i} x={m.x} y={m.y} onCollect={() => setCollected((c) => c + 1)} />)}

      {allCollected && !filtered && (
        <TimingSpot
          x={1424}
          y={760}
          size={280}
          variant="mud"
          idleHint="点击过滤"
          activeHint="停在【最细】处!"
          resolve={(v) => {
            const d = Math.abs(v - 0.5)
            return { q: Math.max(0, 1 - d / 0.5), label: d < 0.12 ? '极细河泥' : d < 0.3 ? '较细河泥' : '偏粗河泥' }
          }}
          onResult={setFiltered}
        />
      )}

      <Abs x={2540} y={1360} w={520} h={170} className="st-basket">
        <div className="st-basket-title">泥桶</div>
        <div className="st-basket-count"><b>{collected}</b> / {MUD.length}{filtered ? ` · 纯度 ${purity}%` : ''}</div>
      </Abs>

      {filtered && (
        <Abs x={874} y={520} w={1400} h={700} className="st-result">
          <div className="st-result-title">过滤河泥 · 完成</div>
          <div className="st-result-line">细河泥 ×{MUD.length}（{filtered.label}）</div>
          <div className="st-result-line">泥料纯度 <b className="st-strong">{purity}%</b></div>
          <div className="st-result-master">师父：{masterLine}</div>
          <button className="st-result-btn" onClick={confirm}>装入泥篓 · 回坊</button>
        </Abs>
      )}

      <SceneChrome back="map" />
    </SceneRoot>
  )
}
