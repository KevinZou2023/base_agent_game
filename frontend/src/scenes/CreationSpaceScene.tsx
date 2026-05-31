import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { TopStatusBar } from '../components/TopStatusBar'
import { BackButton } from '../components/BackButton'
import { useNav } from '../app/nav'
import './CreationSpaceScene.css'

interface Work {
  img: string
  fx: number; fy: number; fw: number; fh: number
  date: string; dx: number; dy: number; dw: number
  score: string; sx: number; sy: number
}

// 创作空间 / 成品 — Figma node 12:580. Finished-works carousel.
const WORKS: Work[] = [
  { img: '/art/cloth-pink.png', fx: 123, fy: 522, fw: 769, fh: 701,
    date: '2025.7.18（导入）', dx: 214, dy: 1261, dw: 589, score: '评分96', sx: 386, sy: 1349 },
  { img: '/art/cloth-brown.png', fx: 1059, fy: 415, fw: 1033, fh: 941,
    date: '2026.5.25', dx: 1407, dy: 1398, dw: 322, score: '评分75', sx: 1462, sy: 1479 },
  { img: '/art/cloth-tan.png', fx: 2259, fy: 537, fw: 770, fh: 701,
    date: '2026.2.13', dx: 2480, dy: 1261, dw: 322, score: '评分88', sx: 2536, sy: 1361 },
]

export function CreationSpaceScene() {
  const { go } = useNav()
  return (
    <SceneRoot paper paperColor="#F2E4C5">
      {/* 成品 label */}
      <Abs x={296} y={404} w={375} h={120} className="cs-tag">成品</Abs>

      {/* 个人 button (top-right) */}
      <Abs x={2394} y={196} w={250} h={174} className="cs-personal" onClick={() => go('personal')}>
        个人
      </Abs>

      {WORKS.map((w) => (
        <div key={w.score}>
          <Abs x={w.fx} y={w.fy} w={w.fw} h={w.fh} className="cs-frame">
            <img className="cs-cloth" src={w.img} alt="成品" />
          </Abs>
          <Abs x={w.dx} y={w.dy} w={w.dw} h={75} className="cs-date">{w.date}</Abs>
          <Abs x={w.sx} y={w.sy} w={260} h={75} className="cs-score">{w.score}</Abs>
        </div>
      ))}

      {/* carousel arrows */}
      <Abs x={840} y={1410} w={170} h={210} className="cs-arrow">
        <svg viewBox="0 0 100 100" width="170" height="210"><path d="M62 18 L34 60 L62 102" fill="none" stroke="#837664" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Abs>
      <Abs x={2115} y={1410} w={170} h={210} className="cs-arrow">
        <svg viewBox="0 0 100 100" width="170" height="210"><path d="M38 18 L66 60 L38 102" fill="none" stroke="#837664" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Abs>

      <TopStatusBar />
      <BackButton onClick={() => go('map')} />
    </SceneRoot>
  )
}
