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

// 仓库 — Figma 12:1414(布料)/69:1310(原料)/69:1509(道具) + 96:3411/96:3677(查看详细信息).
// 三个 tab 内容 + 点击下钻；文案取自 Figma 设计稿原文（散在道具/对话/教程里）。
interface WhItem {
  img?: string
  name: string
  sub: string // 布料=日期；原料/道具=数量(×N)
  desc: string
  keywords?: string
}

const TABS = ['布料', '原料', '道具'] as const
type Tab = (typeof TABS)[number]

// 样例布料 — 玩家作品不足时补底（含 Figma 原版详情/关键词）
const SEED_FABRICS: WhItem[] = [
  {
    img: '/art/cloth-fine.png', name: '一块上等香云纱', sub: '2025.9.1',
    desc: '制作这样一块上等香云纱需要天时地利人和三重结合，晾晒时间、浸染次数、天气都有影响。',
    keywords: '龟裂纹均匀、颜色较淡',
  },
  {
    img: '/art/cloth-brown.png', name: '一块暗沉的香云纱', sub: '2026.5.25',
    desc: '过乌偏重、底色沉郁的一匹。黑亮面厚实，但少了几分透气的层次。',
  },
  {
    img: '/art/cloth-tan.png', name: '一块颜色较淡的香云纱', sub: '2026.2.13',
    desc: '浸染次数尚浅、底色偏淡的一匹。适合做轻薄的夏衫。',
  },
]

// 原料 — Figma 69:1310 显示 河泥/未过滤的河泥 及数量
const MATERIALS: WhItem[] = [
  {
    img: '/art/baike-cailang.png', name: '薯莨', sub: '×7',
    desc: '采自青翠山的薯莨块茎，富含天然单宁，是香云纱红褐底色的根源。',
  },
  {
    name: '河泥', sub: '×5',
    desc: '「过乌」氧化成黑的关键。采集后一定要记得过滤，否则会影响过乌（染坊）的效果。',
  },
  {
    name: '未过滤的河泥', sub: '×2',
    desc: '刚从乌尔河捞起，仍含砂粒杂质。使用前必须先在河边过滤。',
  },
]

// 道具 — Figma 69:1509 显示 夹竹桃/竹子；穗子/香囊来自村民对话
const PROPS: WhItem[] = [
  { name: '夹竹桃', sub: '×3', desc: '神龟庇佑所赠的特殊道具。在青翠山答对神龟的问题便有机会获得。' },
  { name: '竹子', sub: '×4', desc: '晾晒、翻面用的竹晾杆。竹面不会与染液发生反应。' },
  { name: '阿花的穗子', sub: '×3', desc: '帮阿花采薯莨换得的报酬。' },
  { name: '香囊', sub: '×1', desc: '阿花很喜欢你的作品，回赠的香囊，好感+3。' },
]

const fmtDate = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/) // pull Y-M-D straight from ISO, no TZ shift
  if (m) return `${+m[1]}.${+m[2]}.${+m[3]}`
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

export function WarehouseScene() {
  const { go } = useNav()
  const { works } = useGame()
  const [tab, setTab] = useState<Tab>('布料')
  const [detail, setDetail] = useState<WhItem | null>(null)

  const fabricItems: WhItem[] = [
    ...works.map((w) => ({
      img: w.image_url,
      name: `香云纱 · ${w.pattern}`,
      sub: fmtDate(w.created_at),
      desc: `你亲手制作的香云纱，纹样「${w.pattern}」，师父评分 ${w.score} 分。`,
    })),
    ...SEED_FABRICS,
  ]
  const items = (tab === '布料' ? fabricItems : tab === '原料' ? MATERIALS : PROPS).slice(
    0,
    COLS.length * ROWS.length,
  )

  return (
    <SceneRoot paper paperColor="#F2E4C5">
      <Abs x={45} y={266} w={3011} h={1403} className="wh-panel" />

      <Abs x={1222} y={295} w={824} h={153} className="wh-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={`wh-tab${tab === t ? ' is-active' : ''}`}
            onClick={() => {
              setTab(t)
              setDetail(null)
            }}
          >
            {t}
          </button>
        ))}
      </Abs>

      {ROWS.map((ry, ri) =>
        COLS.map((cx, ci) => (
          <Abs key={`${ri}-${ci}`} x={cx} y={ry} w={SLOT_W} h={SLOT_H} className="wh-slot" />
        )),
      )}

      {items.map((it, i) => {
        const x = COLS[i % COLS.length]
        const ry = ROWS[Math.floor(i / COLS.length)]
        return (
          <Abs
            key={`${tab}-${i}`}
            x={x}
            y={ry}
            w={SLOT_W}
            h={SLOT_H + 130}
            className="wh-item"
            onClick={() => setDetail(it)}
            title="查看详细信息"
          >
            <span className="wh-item-media">
              {it.img ? (
                <img className="wh-cloth" src={it.img} alt={it.name} />
              ) : (
                <span className="wh-tile">{it.name.slice(0, 1)}</span>
              )}
            </span>
            <span className="wh-label">{it.name}</span>
            <span className="wh-date">{it.sub}</span>
          </Abs>
        )
      })}

      {/* 查看详细信息 — Figma 96:3411 / 96:3677 */}
      {detail && (
        <>
          <Abs x={0} y={0} w={3148} h={1773} className="wh-veil" onClick={() => setDetail(null)} />
          <Abs x={524} y={356} w={2100} h={1060} className="wh-detail">
            <button className="wh-detail-close" onClick={() => setDetail(null)} title="返回">
              ×
            </button>
            <span className="wh-detail-media">
              {detail.img ? (
                <img src={detail.img} alt={detail.name} />
              ) : (
                <span className="wh-tile">{detail.name.slice(0, 1)}</span>
              )}
            </span>
            <span className="wh-detail-info">
              <span className="wh-detail-name">{detail.name}</span>
              <span className="wh-detail-sub">{detail.sub}</span>
              <span className="wh-detail-desc">{detail.desc}</span>
              {detail.keywords && <span className="wh-detail-kw">关键词：{detail.keywords}</span>}
            </span>
          </Abs>
        </>
      )}

      <TopStatusBar />
      <NavTabs />
      <BackButton onClick={() => go('map')} />
    </SceneRoot>
  )
}
