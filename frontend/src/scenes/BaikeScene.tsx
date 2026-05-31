import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { TopStatusBar } from '../components/TopStatusBar'
import { BackButton } from '../components/BackButton'
import { useNav } from '../app/nav'
import './BaikeScene.css'

interface Card {
  img: string
  ix: number; iy: number; iw: number; ih: number
  tx: number; ty: number; tw: number; th: number
  title: string
  body: string
}

// 百科 — Figma node 24:659. Four illustrated craft-step cards.
const CARDS: Card[] = [
  {
    img: '/art/baike-cailang.png', ix: 420, iy: 599, iw: 388, ih: 386,
    tx: 889, ty: 620, tw: 626, th: 319,
    title: '【采莨】',
    body: '工匠会采集成熟薯莨，并将其洗净、切碎。薯莨中的天然单宁，是香云纱染色的重要来源。',
  },
  {
    img: '/art/baike-zhazhi.png', ix: 412, iy: 1081, iw: 390, ih: 376,
    tx: 889, ty: 1126, tw: 626, th: 264,
    title: '【榨汁】',
    body: '切碎后的薯莨会被反复捣压，提取深褐色汁液。汁液越浓，布料最终颜色越深。',
  },
  {
    img: '/art/baike-shualang.png', ix: 1677, iy: 601, iw: 390, ih: 382,
    tx: 2146, ty: 633, tw: 645, th: 319,
    title: '【刷莨】',
    body: '工匠使用木刷，将莨汁均匀涂抹在丝绸表面。每一次刷染，都会让颜色逐渐沉淀。',
  },
  {
    img: '/art/baike-baoshai.png', ix: 1677, iy: 1077, iw: 396, ih: 376,
    tx: 2146, ty: 1107, tw: 612, th: 264,
    title: '【暴晒】',
    body: '布匹需要在烈日下反复晾晒。阳光会让植物染料慢慢氧化，形成独特光泽。',
  },
]

export function BaikeScene() {
  const { go } = useNav()
  return (
    <SceneRoot paper paperColor="#EFE9D9">
      {CARDS.map((c) => (
        <div key={c.title}>
          <Abs x={c.ix} y={c.iy} w={c.iw} h={c.ih}>
            <img className="baike-img" src={c.img} alt={c.title} />
          </Abs>
          <Abs x={c.tx} y={c.ty} w={c.tw} h={c.th} className="baike-text">
            <span className="baike-title">{c.title}</span>
            {c.body}
          </Abs>
        </div>
      ))}
      <TopStatusBar />
      <BackButton onClick={() => go('map')} />
    </SceneRoot>
  )
}
