import { useState } from 'react'
import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { TopStatusBar } from '../components/TopStatusBar'
import { NavTabs } from '../components/NavTabs'
import { BackButton } from '../components/BackButton'
import { useNav } from '../app/nav'
import './WarehouseScene.css'

const COLS = [158, 744, 1330, 1916, 2502]
const ROWS = [497, 1093]
const SLOT_W = 493
const SLOT_H = 461

interface Item {
  col: number
  img: string
  label: string
  date: string
}

// 仓库-布料 — Figma node 12:1414. Three fabrics on the 布料 tab.
const FABRICS: Item[] = [
  { col: 0, img: '/art/cloth-fine.png', label: '一块上等香云纱', date: '2025.9.1' },
  { col: 1, img: '/art/cloth-brown.png', label: '一块暗沉的香云纱', date: '2026.5.25' },
  { col: 2, img: '/art/cloth-tan.png', label: '一块颜色较淡的香云纱', date: '2026.2.13' },
]

const TABS = ['布料', '原料', '道具'] as const

export function WarehouseScene() {
  const { go } = useNav()
  const [tab, setTab] = useState<(typeof TABS)[number]>('布料')

  return (
    <SceneRoot paper paperColor="#F2E4C5">
      {/* framed content panel */}
      <Abs x={45} y={266} w={3011} h={1403} className="wh-panel" />

      {/* 布料 / 原料 / 道具 segmented control */}
      <Abs x={1222} y={295} w={824} h={153} className="wh-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={`wh-tab${tab === t ? ' is-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </Abs>

      {/* slot grid (5 x 2) */}
      {ROWS.map((ry, ri) =>
        COLS.map((cx, ci) => (
          <Abs key={`${ri}-${ci}`} x={cx} y={ry} w={SLOT_W} h={SLOT_H} className="wh-slot" />
        )),
      )}

      {/* filled fabric items (top row) */}
      {tab === '布料' &&
        FABRICS.map((it) => {
          const x = COLS[it.col]
          return (
            <div key={it.label}>
              <Abs x={x + 30} y={ROWS[0] + 27} w={SLOT_W - 60} h={SLOT_H - 54}>
                <img className="wh-cloth" src={it.img} alt={it.label} />
              </Abs>
              <Abs x={x - 40} y={ROWS[0] + 461} w={SLOT_W + 80} h={70} className="wh-label">
                {it.label}
              </Abs>
              <Abs x={x} y={ROWS[0] + 521} w={SLOT_W} h={60} className="wh-date">
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
