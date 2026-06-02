import { useState } from 'react'
import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { TopStatusBar } from '../components/TopStatusBar'
import { BackButton } from '../components/BackButton'
import { useNav } from '../app/nav'
import { useGame, type StudioWork } from '../app/GameState'
import './CreationSpaceScene.css'

// 创作空间 / 成品 — Figma node 12:580. 真实作品展柜：玩家生成的香云纱按时间倒序，
// 居中位为最新成品；不足处用导入样例补位。箭头翻页。
interface Slot {
  fx: number; fy: number; fw: number; fh: number
  dx: number; dy: number; dw: number
  sx: number; sy: number
}
// 顺序 = 显示优先级：[居中(主展位), 左, 右]
const SLOTS: Slot[] = [
  { fx: 1059, fy: 415, fw: 1033, fh: 941, dx: 1190, dy: 1398, dw: 770, sx: 1462, sy: 1479 },
  { fx: 123, fy: 522, fw: 769, fh: 701, dx: 123, dy: 1261, dw: 769, sx: 386, sy: 1349 },
  { fx: 2259, fy: 537, fw: 770, fh: 701, dx: 2259, dy: 1261, dw: 770, sx: 2536, sy: 1361 },
]

// 导入样例 — 玩家作品不足 3 件时补位，作品集永不空场
const SEED: StudioWork[] = [
  { artwork_id: 'seed_pink', image_url: '/art/cloth-pink.png', pattern: '海水江崖', score: 96, created_at: '2025-07-18', mocked: false },
  { artwork_id: 'seed_tan', image_url: '/art/cloth-tan.png', pattern: '云纹', score: 88, created_at: '2026-02-13', mocked: false },
  { artwork_id: 'seed_fine', image_url: '/art/cloth-fine.png', pattern: '福寿纹', score: 92, created_at: '2025-09-01', mocked: false },
]

const fmtDate = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/) // pull Y-M-D straight from ISO, no TZ shift
  if (m) return `${+m[1]}.${+m[2]}.${+m[3]}`
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

export function CreationSpaceScene() {
  const { go } = useNav()
  const { works } = useGame()
  const [page, setPage] = useState(0)

  const all = [...works, ...SEED]
  const pages = Math.ceil(all.length / SLOTS.length)
  const visible = all.slice(page * SLOTS.length, page * SLOTS.length + SLOTS.length)
  const canPrev = page > 0
  const canNext = page < pages - 1

  return (
    <SceneRoot paper paperColor="#F2E4C5">
      <Abs x={296} y={404} w={375} h={120} className="cs-tag">成品</Abs>

      <Abs x={2394} y={196} w={250} h={174} className="cs-personal" onClick={() => go('personal')}>
        个人
      </Abs>

      {visible.map((w, i) => {
        const s = SLOTS[i]
        return (
          <div key={w.artwork_id + page}>
            <Abs x={s.fx} y={s.fy} w={s.fw} h={s.fh} className="cs-frame">
              <img className="cs-cloth" src={w.image_url} alt={`成品 · ${w.pattern}`} />
            </Abs>
            <Abs x={s.dx} y={s.dy} w={s.dw} h={75} className="cs-date">
              {w.pattern} · {fmtDate(w.created_at)}
            </Abs>
            <Abs x={s.sx} y={s.sy} w={420} h={75} className="cs-score">
              评分{w.score}
              {w.mocked && <span className="cs-mock">示范</span>}
            </Abs>
          </div>
        )
      })}

      <Abs
        x={840} y={1410} w={170} h={210}
        className={`cs-arrow${canPrev ? '' : ' is-disabled'}`}
        onClick={() => canPrev && setPage((p) => p - 1)}
      >
        <svg viewBox="0 0 100 100" width="170" height="210"><path d="M62 18 L34 60 L62 102" fill="none" stroke="#837664" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Abs>
      <Abs
        x={2115} y={1410} w={170} h={210}
        className={`cs-arrow${canNext ? '' : ' is-disabled'}`}
        onClick={() => canNext && setPage((p) => p + 1)}
      >
        <svg viewBox="0 0 100 100" width="170" height="210"><path d="M38 18 L66 60 L38 102" fill="none" stroke="#837664" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Abs>

      <TopStatusBar />
      <BackButton onClick={() => go('map')} />
    </SceneRoot>
  )
}
