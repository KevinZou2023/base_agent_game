import { useState } from 'react'
import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { TopStatusBar } from '../components/TopStatusBar'
import { BackButton } from '../components/BackButton'
import { useNav } from '../app/nav'
import { useGame, type StudioWork } from '../app/GameState'
import './CreationSpaceScene.css'

// 创作空间 — Figma 12:580(成品)/12:805(公共空间)/72:2156(个人)/72:5604(订购延申).
// 三视图：成品(个人作品展柜) / 公共(社区+评价+订购) / 个人(命名保存)。
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

// 导入样例 — 玩家作品不足 3 件时补位
const SEED: StudioWork[] = [
  { artwork_id: 'seed_pink', image_url: '/art/cloth-pink.png', pattern: '海水江崖', score: 96, created_at: '2025-07-18', mocked: false },
  { artwork_id: 'seed_tan', image_url: '/art/cloth-tan.png', pattern: '云纹', score: 88, created_at: '2026-02-13', mocked: false },
  { artwork_id: 'seed_fine', image_url: '/art/cloth-fine.png', pattern: '福寿纹', score: 92, created_at: '2025-09-01', mocked: false },
]

// 公共空间社区作品（Figma 12:805）— 名称/用料/评分/评价记录全取自设计稿原文
interface CommWork {
  name: string; material: string; score: number; date: string; img: string; reviews: string[]
}
const COMMUNITY: CommWork[] = [
  {
    name: '紫云巾', material: '紫色香云纱布料', score: 88, date: '2025.3.21', img: '/art/cloth-pink.png',
    reviews: ['结合了新技术，还从制作衣服的范围跳脱出来，不错——84分', '这个发圈用料特别，工艺细节都值得考究，我很喜欢——92分'],
  },
  {
    name: '乌金披帛', material: '过乌黑亮香云纱', score: 93, date: '2025.4.2', img: '/art/cloth-brown.png',
    reviews: ['好漂亮的工艺，我也想去找定制一条了——93分', '哇，好厉害，这个颜色的布料一定试了很久吧——91分'],
  },
  {
    name: '素莨方巾', material: '浅染香云纱', score: 78, date: '2025.5.18', img: '/art/cloth-tan.png',
    reviews: ['做事既不能心急，也不能太缓，更要学会变通——72分', '诶呀，在晴天晒太久了就这样了，导致龟裂纹很多——78分'],
  },
]
const COMM_COLS = [200, 1164, 2128]

const VIEWS = ['成品', '公共', '个人'] as const
type View = (typeof VIEWS)[number]

const fmtDate = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/) // pull Y-M-D straight from ISO, no TZ shift
  if (m) return `${+m[1]}.${+m[2]}.${+m[3]}`
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

export function CreationSpaceScene() {
  const { go } = useNav()
  const { works } = useGame()
  const [view, setView] = useState<View>('成品')
  const [page, setPage] = useState(0)
  const [detail, setDetail] = useState<CommWork | null>(null)
  const [ordered, setOrdered] = useState(false)
  const [diyName, setDiyName] = useState('')
  const [diyMsg, setDiyMsg] = useState('')

  const all = [...works, ...SEED]
  const pages = Math.ceil(all.length / SLOTS.length)
  const visible = all.slice(page * SLOTS.length, page * SLOTS.length + SLOTS.length)
  const canPrev = page > 0
  const canNext = page < pages - 1

  const openDetail = (c: CommWork) => {
    setDetail(c)
    setOrdered(false)
  }

  return (
    <SceneRoot paper paperColor="#F2E4C5">
      {/* 成品 / 公共 / 个人 三视图切换 */}
      <Abs x={974} y={150} w={1200} h={150} className="cs-tabs">
        {VIEWS.map((v) => (
          <button key={v} className={`cs-tab${view === v ? ' is-active' : ''}`} onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </Abs>

      {/* ── 成品：个人作品展柜 ── */}
      {view === '成品' && (
        <>
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
          <Abs x={840} y={1410} w={170} h={210} className={`cs-arrow${canPrev ? '' : ' is-disabled'}`} onClick={() => canPrev && setPage((p) => p - 1)}>
            <svg viewBox="0 0 100 100" width="170" height="210"><path d="M62 18 L34 60 L62 102" fill="none" stroke="#837664" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Abs>
          <Abs x={2115} y={1410} w={170} h={210} className={`cs-arrow${canNext ? '' : ' is-disabled'}`} onClick={() => canNext && setPage((p) => p + 1)}>
            <svg viewBox="0 0 100 100" width="170" height="210"><path d="M38 18 L66 60 L38 102" fill="none" stroke="#837664" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Abs>
        </>
      )}

      {/* ── 公共：社区画廊（点击看评价 + 订购）── */}
      {view === '公共' && (
        <>
          {COMMUNITY.map((c, i) => (
            <Abs key={c.name} x={COMM_COLS[i]} y={520} w={820} h={1000} className="cs-comm" onClick={() => openDetail(c)} title="查看评价 · 可订购">
              <span className="cs-comm-media">
                <img src={c.img} alt={c.name} />
              </span>
              <span className="cs-comm-name">{c.name}</span>
              <span className="cs-comm-meta">{c.material}</span>
              <span className="cs-comm-foot">
                <span className="cs-comm-score">评分{c.score}</span>
                <span className="cs-comm-buy">可订购 ›</span>
              </span>
            </Abs>
          ))}
        </>
      )}

      {/* ── 个人：命名 / 保存（Figma 个人空间 72:2156）── */}
      {view === '个人' && (
        <Abs x={774} y={520} w={1600} h={900} className="cs-diy">
          <span className="cs-diy-title">个人空间</span>
          <span className="cs-diy-hint">为你的香云纱作品命名，保存到个人收藏</span>
          <input
            className="cs-diy-input"
            placeholder="请输入作品名……"
            value={diyName}
            onChange={(e) => { setDiyName(e.target.value); setDiyMsg('') }}
          />
          <span className="cs-diy-btns">
            <button className="cs-diy-btn" onClick={() => setDiyMsg(diyName.trim() ? `已保存「${diyName.trim()}」到个人收藏` : '请先输入作品名')}>
              保存
            </button>
            <button className="cs-diy-btn ghost" onClick={() => { setDiyName('海水江崖·披帛'); setDiyMsg('已导入样例作品名') }}>
              导入
            </button>
          </span>
          {diyMsg && <span className="cs-diy-msg">{diyMsg}</span>}
        </Abs>
      )}

      {/* ── 公共作品详情 + 评价记录 + 订购延申 ── */}
      {detail && (
        <>
          <Abs x={0} y={0} w={3148} h={1773} className="cs-veil" onClick={() => setDetail(null)} />
          <Abs x={474} y={300} w={2200} h={1180} className="cs-detail">
            <button className="cs-detail-close" onClick={() => setDetail(null)} title="返回">×</button>
            <span className="cs-detail-media">
              <img src={detail.img} alt={detail.name} />
            </span>
            <span className="cs-detail-info">
              <span className="cs-detail-name">{detail.name}</span>
              <span className="cs-detail-meta">用料：{detail.material} · 评分 {detail.score} · {detail.date}</span>

              <span className="cs-detail-reviews-label">评价记录：</span>
              {detail.reviews.map((r, i) => (
                <span key={i} className="cs-detail-review">{r}</span>
              ))}

              <span className="cs-order">
                {!ordered ? (
                  <>
                    <span className="cs-order-vendor">厂商 · 拾遗纱 非遗制作商</span>
                    <span className="cs-order-price">预计 ¥{detail.score * 18} · 送至线下</span>
                    <button className="cs-order-btn" onClick={() => setOrdered(true)}>订购</button>
                  </>
                ) : (
                  <span className="cs-order-done">已下单！拾遗纱将按这匹香云纱定制成衣，送至线下。</span>
                )}
              </span>
            </span>
          </Abs>
        </>
      )}

      <TopStatusBar />
      <BackButton onClick={() => go('map')} />
    </SceneRoot>
  )
}
