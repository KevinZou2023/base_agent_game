import { useState } from 'react'
import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { TopStatusBar } from '../components/TopStatusBar'
import { NavTabs } from '../components/NavTabs'
import { BackButton } from '../components/BackButton'
import { useNav } from '../app/nav'
import './BaikeScene.css'

// 百科 — Figma node 24:659 + 标签栏组件 112:18210（5 标签）。
// 内容全部取自 Figma 设计稿原文（工艺卡 + 散落在教程/对话/道具里的词条）；
// Figma 未为新标签写成段内容处，用稿中既有的花纹名 / 原句兜底，不编造。
type TabId = '纹样' | '材料' | '历史' | '天气' | '冷知识'
const TABS: TabId[] = ['纹样', '材料', '历史', '天气', '冷知识']

interface Card {
  img?: string
  title: string
  body: string
}
interface Prose {
  title: string
  body: string
}

// 卡片式标签（4 格图文网格，沿用原百科版式）
const CARDS: Partial<Record<TabId, Card[]>> = {
  纹样: [
    { img: '/art/pattern-cloud.png', title: '云纹', body: '祥云绵延起伏，取高升、如意之意，是香云纱常见的吉祥纹样。' },
    { img: '/art/cloth-pink.png', title: '海水江崖', body: '水浪与山崖相叠，象征福山寿海、江山永固，多见于礼服下摆。' },
    { img: '/art/cloth-fine.png', title: '福寿纹', body: '以蝙蝠与「寿」字组合，取「福寿双全」的彩头。' },
    { img: '/art/cloth-tan.png', title: '龟裂纹', body: '「在晴天晒太久了，导致龟裂纹很多」——晾晒过度时布面析出的细密裂纹。' },
  ],
  材料: [
    { img: '/art/baike-cailang.png', title: '薯莨', body: '工匠采集成熟薯莨，洗净、切碎。薯莨中的天然单宁，是香云纱染色的重要来源。' },
    { img: '/art/baike-zhazhi.png', title: '莨汁', body: '切碎后的薯莨反复捣压，提取深褐色汁液。汁液越浓，布料最终颜色越深。' },
    { title: '河泥', body: '「过乌」氧化成黑的关键。采集河泥后一定要记得过滤，否则会影响过乌（染坊）的效果。' },
    { img: '/art/baike-shualang.png', title: '丝绸', body: '工匠用木刷将莨汁均匀涂抹在丝绸表面，每一次刷染，都让颜色逐渐沉淀。' },
  ],
  天气: [
    { img: '/art/baike-baoshai.png', title: '暴晒', body: '布匹需在烈日下反复晾晒。阳光会让植物染料慢慢氧化，形成独特光泽。' },
    { title: '看天吃饭', body: '正上方的天气也会影响，阴天雨天更是不能晒布——香云纱看天吃饭，急不得。' },
    { title: '过犹不及', body: '晴天也不能晒太久，否则布面会出现过多龟裂纹，反而损了品相。' },
  ],
}

// 长文式标签（成段词条）
const PROSE: Partial<Record<TabId, Prose[]>> = {
  历史: [
    { title: '看天吃饭的非遗珍品', body: '香云纱是我国著名非遗之一，尤其看重天时地利，是看天吃饭的非遗珍品。' },
    { title: '天时地利人和', body: '制作一块上等香云纱，需要天时地利人和三重结合——晾晒时间、浸染次数、天气都有影响。' },
    { title: '三蒸九煮十八晒', body: '民间素有「三蒸九煮十八晒」之说，一匹成纱要历经数十道工序、反复浸染晾晒，道尽其繁复。' },
  ],
  冷知识: [
    {
      title: '薯莨的智慧',
      body: '薯莨果是薯莨的球状块茎，长在地面上。只有当最大的薯莨果被人取走，底下的小薯果才能享有充分的养料，继续生长。因此，人们对薯莨的适度取用不仅不会损害薯莨、破坏植被，反而满足了薯莨生长的需要。',
    },
    {
      title: '鸡蛋花',
      body: '鸡蛋花树冠如盖，身姿优美，花色丰富美丽，常栽培作观赏，在中国的海南、福建、广西、广东、云南等地均有栽培。',
    },
    {
      title: '青翠山的神龟',
      body: '在采集薯莨的青翠山，有时会碰见神龟。与它自由对话、答对问题，便可获得特殊道具。',
    },
  ],
}

// 4 格图文位（沿用 Figma 24:659 原版式）
const SLOTS = [
  { ix: 420, iy: 599, iw: 388, ih: 386, tx: 889, ty: 620, tw: 626, th: 319 },
  { ix: 412, iy: 1081, iw: 390, ih: 376, tx: 889, ty: 1126, tw: 626, th: 264 },
  { ix: 1677, iy: 601, iw: 390, ih: 382, tx: 2146, ty: 633, tw: 645, th: 319 },
  { ix: 1677, iy: 1077, iw: 396, ih: 376, tx: 2146, ty: 1107, tw: 612, th: 264 },
] as const

export function BaikeScene() {
  const { go } = useNav()
  const [tab, setTab] = useState<TabId>('纹样')

  const cards = CARDS[tab]
  const prose = PROSE[tab]

  return (
    <SceneRoot paper paperColor="#EFE9D9">
      {/* 5 标签切换栏 — Figma 组件 112:18210 */}
      <Abs x={614} y={414} w={1920} h={120} className="baike-tabbar">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`baike-tab${tab === t ? ' is-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </Abs>

      {/* 卡片式内容 */}
      {cards?.map((c, i) => {
        const s = SLOTS[i]
        if (!s) return null
        return (
          <div key={c.title}>
            <Abs x={s.ix} y={s.iy} w={s.iw} h={s.ih}>
              {c.img ? (
                <img className="baike-img" src={c.img} alt={c.title} />
              ) : (
                <span className="baike-tile">{c.title.slice(0, 1)}</span>
              )}
            </Abs>
            <Abs x={s.tx} y={s.ty} w={s.tw} h={s.th} className="baike-text">
              <span className="baike-title">【{c.title}】</span>
              {c.body}
            </Abs>
          </div>
        )
      })}

      {/* 长文式内容 */}
      {prose && (
        <Abs x={420} y={596} w={2308} h={1040} className="baike-prose">
          {prose.map((p) => (
            <div key={p.title} className="baike-prose-entry">
              <h3 className="baike-prose-title">{p.title}</h3>
              <p className="baike-prose-body">{p.body}</p>
            </div>
          ))}
        </Abs>
      )}

      <TopStatusBar />
      <NavTabs />
      <BackButton onClick={() => go('map')} />
    </SceneRoot>
  )
}
