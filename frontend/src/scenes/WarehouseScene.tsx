import { useState } from 'react'
import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { TopStatusBar } from '../components/TopStatusBar'
import { NavTabs } from '../components/NavTabs'
import { BackButton } from '../components/BackButton'
import { useNav } from '../app/nav'
import { useGame } from '../app/GameState'
import './WarehouseScene.css'

const COLS = [158, 744, 1330, 1916, 2502]
const ROWS = [497, 1093]
const SLOT_W = 493
const SLOT_H = 461

interface Fabric {
  img: string
  label: string
  date: string
}

// 仓库-布料 — Figma node 12:1414. 玩家织成的香云纱按时间倒序入库，样例布料补底.
const SEED_FABRICS: Fabric[] = [
  { img: '/art/cloth-fine.png', label: '一块上等香云纱', date: '2025.9.1' },
  { img: '/art/cloth-brown.png', label: '一块暗沉的香云纱', date: '2026.5.25' },
  { img: '/art/cloth-tan.png', label: '一块颜色较淡的香云纱', date: '2026.2.13' },
]

const TABS = ['布料', '原料', '道具'] as const

const fmtDate = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/) // pull Y-M-D straight from ISO, no TZ shift
  if (m) return `${+m[1]}.${+m[2]}.${+m[3]}`
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

export function WarehouseScene() {
  const { go } = useNav()
  const { works } = useGame()
  const [tab, setTab] = useState<(typeof TABS)[number]>('布料')

  const fabrics: Fabric[] = [
    ...works.map((w) => ({
      img: w.image_url,
      label: `香云纱 · ${w.pattern}（评分${w.score}）`,
      date: fmtDate(w.created_at),
    })),
    ...SEED_FABRICS,
  ].slice(0, COLS.length * ROWS.length)

  return (
    <SceneRoot paper paperColor="#F2E4C5">
      <Abs x={45} y={266} w={3011} h={1403} className="wh-panel" />

      <Abs x={1222} y={295} w={824} h={153} className="wh-tabs">
        {TABS.map((t) => (
          <button key={t} className={`wh-tab${tab === t ? ' is-active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </Abs>

      {ROWS.map((ry, ri) =>
        COLS.map((cx, ci) => (
          <Abs key={`${ri}-${ci}`} x={cx} y={ry} w={SLOT_W} h={SLOT_H} className="wh-slot" />
        )),
      )}

      {tab === '布料' &&
        fabrics.map((it, i) => {
          const x = COLS[i % COLS.length]
          const ry = ROWS[Math.floor(i / COLS.length)]
          return (
            <div key={i}>
              <Abs x={x + 30} y={ry + 27} w={SLOT_W - 60} h={SLOT_H - 54}>
                <img className="wh-cloth" src={it.img} alt={it.label} />
              </Abs>
              <Abs x={x - 40} y={ry + 461} w={SLOT_W + 80} h={70} className="wh-label">
                {it.label}
              </Abs>
              <Abs x={x} y={ry + 521} w={SLOT_W} h={60} className="wh-date">
                {it.date}
              </Abs>
            </div>
          )
        })}

      <TopStatusBar />
      <NavTabs />
      <BackButton onClick={() => go('map')} />
    </SceneRoot>
  )
}
