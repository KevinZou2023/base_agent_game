import { Suspense, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Center, ContactShadows, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useNav } from '../app/nav'
import './Showcase3DScene.css'

type Dimension = {
  name: string
  value: number
  note: string
}

type MemoryStep = {
  label: string
  title: string
  body: string
}

type SampleCase = {
  id: 'one' | 'two'
  name: string
  modelUrl: string
  dimensions: Dimension[]
  mentor: string
  warning: string
  knowledge: string
  memory: MemoryStep[]
}

const CASES: SampleCase[] = [
  {
    id: 'one',
    name: '一号样品',
    modelUrl: '/models/chenggong.glb',
    dimensions: [
      { name: '工艺', value: 94, note: '等待时间充分，黑亮面稳定形成' },
      { name: '纹样', value: 92, note: '三朵祥云结构清楚，疏密自然' },
      { name: '色彩', value: 91, note: '正面乌黑油润，背面红褐层次明确' },
      { name: '文化', value: 95, note: '祥云寓意完整，贴合岭南非遗叙事' },
      { name: '进步', value: 90, note: '工艺参数控制成熟，可练更细纹样' },
    ],
    mentor:
      '一号样品火候稳，等待时间够，黑亮面有油润感，三朵祥云也立得住。下一步可以练更细的边线，让云脚更轻。',
    warning: '优势项 · 过乌等待充分 · 黑亮面油润度达标',
    knowledge:
      '一号样品显示：等待时间充分时，河泥与薯莨单宁反应更完整，布面由红褐转为乌黑亮泽，祥云纹样边缘也更稳定。',
    memory: [
      {
        label: '第一站',
        title: '我先去了老师傅家',
        body: '我问老师傅，香云纱为什么被叫作“软黄金”。师傅从薯莨、太阳和河泥慢慢说起。',
      },
      {
        label: '采料',
        title: '我去山里找薯莨',
        body: '这一步让我知道，红褐底色不是颜料随便涂上去的，而是薯莨汁一遍遍吃进布里。',
      },
      {
        label: '我问了',
        title: '“浸染少几遍行不行？”',
        body: '师傅说不急，香云纱靠的是层层叠色。旁边的小助手也提醒我：单宁吃得够，后面的过乌才有基础。',
      },
      {
        label: '动手',
        title: '我完成了浸染、晒莨和过乌',
        body: '这一轮我等得比较稳，翻面观察也及时。布面慢慢从红褐转出黑亮感的时候，工艺终于有点“活”起来了。',
      },
      {
        label: '被提醒',
        title: '过乌前我检查了三个点',
        body: '小助手提醒我看泥浆厚度、等待时间和翻面状态。这个提醒让我没有太早收布。',
      },
      {
        label: '记住了',
        title: '黑亮面不是直接染出来的',
        body: '我记住了：红褐底色靠薯莨反复浸染，黑亮面靠河泥里的铁和布上的单宁慢慢反应。',
      },
    ],
  },
  {
    id: 'two',
    name: '二号样品',
    modelUrl: '/models/shibai.glb',
    dimensions: [
      { name: '工艺', value: 72, note: '染色工序正常，问题集中在过乌等待' },
      { name: '纹样', value: 84, note: '花束结构清楚，但浅色削弱了层次' },
      { name: '色彩', value: 78, note: '染色没大问题，过乌不足让花色偏浅' },
      { name: '文化', value: 80, note: '题材完整，但黑亮面还没形成非遗质感' },
      { name: '进步', value: 78, note: '染色控制有进步，下次重点补足过乌时长' },
    ],
    mentor:
      '这次香云纱前面的染色没有大问题，底色吃得住，说明染色工序是稳的。问题在过乌等待时间不够，泥和薯莨还没反应到位就收了，所以花的颜色显得偏浅，黑亮面也没完全起来。下次染色参数可以保留，重点把过乌时间等足。',
    warning: '风险项 · 染色工序正常 · 过乌等待不足 · 花色偏浅',
    knowledge:
      '二号样品显示：香云纱染色阶段基本正常，问题主要发生在过乌等待环节。等待时间不足会让河泥与薯莨单宁反应停在中段，导致花的颜色偏浅，黑亮油润感没有完全生成。',
    memory: [
      {
        label: '第一站',
        title: '我从老师傅家进了工坊',
        body: '这轮我想做出一束花的效果。师傅先让我记住：先把薯莨底色做好，再看过乌能不能把黑亮面带出来。',
      },
      {
        label: '采料',
        title: '我准备了薯莨和河泥',
        body: '采料时我才发现，河泥不是装饰材料，它会影响最后那层乌黑油亮的质感。',
      },
      {
        label: '我问了',
        title: '“为什么要反复浸染？”',
        body: '师傅说，薯莨汁要一层层吃进丝绸里。小助手在旁边补了一句：这是为了给后面的过乌留下反应基础。',
      },
      {
        label: '动手',
        title: '我完成了染色，但收布有点急',
        body: '前面的染色其实还算顺，底色也吃住了。问题出在过乌时，我等得不够久就收了布。',
      },
      {
        label: '被提醒',
        title: '小助手没有把问题怪到染色上',
        body: '它提醒我：这次不是染色坏了，而是过乌等待不够，所以花的颜色显得偏浅，黑亮面还没完全起来。',
      },
      {
        label: '记住了',
        title: '花色偏浅不一定是染色错了',
        body: '我这次学到：染色可以是对的，但过乌等不够，最后的花色还是会浅。下次要保留染色方法，把等待时间补足。',
      },
    ],
  },
]

function totalScore(sample: SampleCase): number {
  return Math.round(sample.dimensions.reduce((sum, item) => sum + item.value, 0) / sample.dimensions.length)
}

function SampleModel({ url }: { url: string }) {
  const gltf = useGLTF(url) as { scene: THREE.Group }
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  return (
    <Center>
      <primitive object={model} rotation={[0, 0, Math.PI]} scale={1.8} />
    </Center>
  )
}

useGLTF.preload('/models/chenggong.glb')
useGLTF.preload('/models/shibai.glb')

export function Showcase3DScene() {
  const { go } = useNav()
  const [activeId, setActiveId] = useState<SampleCase['id']>('one')
  const [showScore, setShowScore] = useState(false)

  const active = CASES.find((sample) => sample.id === activeId) ?? CASES[0]
  const score = totalScore(active)

  return (
    <div className="sample-review-root">
      <header className="sample-review-top">
        <button className="sample-review-back" type="button" onClick={() => go('weaving')}>
          ‹ 返回工坊
        </button>
        <div className="sample-review-brand">
          <h1>香云纱</h1>
          <p>GAMBIERED CANTON GAUZE · 非遗学习成品回顾</p>
        </div>
        <button className="sample-review-log-button" type="button" onClick={() => setShowScore(true)}>
          五维评分
        </button>
      </header>

      <main className="sample-review-layout">
        <aside className="sample-score-panel">
          <div className="sample-panel-title">
            <span>当前样品</span>
            <strong>{active.name}</strong>
          </div>

          <div className="sample-total">
            <span>{score}</span>
            <small>总评</small>
          </div>

          <div className="sample-case-list" aria-label="样品选择">
            {CASES.map((sample) => (
              <button
                className="sample-case-card"
                type="button"
                key={sample.id}
                aria-pressed={sample.id === activeId}
                onClick={() => setActiveId(sample.id)}
              >
                <span>{sample.id === 'one' ? '样品一号' : '样品二号'}</span>
                <strong>{sample.name}</strong>
                <small>{totalScore(sample)} 分</small>
              </button>
            ))}
          </div>

          <div className="sample-dimensions">
            {active.dimensions.map((item) => (
              <article className="sample-dimension" key={item.name}>
                <div>
                  <span>{item.name}</span>
                  <strong>{item.value}</strong>
                </div>
                <i>
                  <b style={{ width: `${item.value}%` }} />
                </i>
                <p>{item.note}</p>
              </article>
            ))}
          </div>

          <button className="sample-primary" type="button" onClick={() => setShowScore(true)}>
            查看师父点评
          </button>
        </aside>

        <section className="sample-model-stage" aria-label="3D 样品展示">
          <Canvas
            shadows
            dpr={[1, 1.5]}
            camera={{ position: [0, 0.8, 6.2], fov: 38 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.08 }}
          >
            <color attach="background" args={['#efe7d2']} />
            <fog attach="fog" args={['#efe7d2', 9, 24]} />
            <ambientLight intensity={0.85} />
            <hemisphereLight color="#fff4d8" groundColor="#8aa58a" intensity={1.6} />
            <directionalLight position={[4, 5, 3]} intensity={3.1} color="#ffddb0" castShadow />
            <directionalLight position={[-3, 2, -4]} intensity={1.25} color="#b6d6c2" />
            <Suspense fallback={null}>
              <SampleModel url={active.modelUrl} />
              <ContactShadows position={[0, -1.75, 0]} opacity={0.22} scale={8} blur={2.6} far={4} color="#7d6d4e" />
            </Suspense>
            <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.65} minDistance={3.2} maxDistance={8} />
          </Canvas>

          <div className="sample-model-label">
            <span>360 度查看</span>
            <strong>{active.name}</strong>
          </div>
        </section>

        <aside className="sample-memory-panel">
          <div className="sample-memory-title">
            <span />
            <h2>我的学习回忆</h2>
            <b>LOG</b>
          </div>

          <div className="sample-memory-list">
            {active.memory.map((step) => (
              <article className="sample-memory-step" key={`${step.label}-${step.title}`}>
                <em>{step.label}</em>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </aside>
      </main>

      <section className="sample-knowledge">
        <span>知识卡</span>
        <p>{active.knowledge}</p>
      </section>

      {showScore && (
        <div className="sample-score-modal" role="dialog" aria-modal="true" aria-labelledby="sample-score-title">
          <button className="sample-modal-backdrop" type="button" aria-label="关闭评分" onClick={() => setShowScore(false)} />
          <section className="sample-modal-card">
            <button className="sample-modal-close" type="button" aria-label="关闭五维评分" onClick={() => setShowScore(false)}>
              ×
            </button>
            <div className="sample-modal-head">
              <div>
                <h2 id="sample-score-title">样品复盘</h2>
                <span>{active.name} · AI 复盘评分</span>
              </div>
              <strong>
                总评 <b>{score}</b>
              </strong>
            </div>

            <div className="sample-modal-grid">
              <div className="sample-modal-score">
                <span>{score}</span>
                <small>总评</small>
              </div>
              <div className="sample-modal-dims">
                {active.dimensions.map((item) => (
                  <article className="sample-modal-row" key={item.name}>
                    <span>{item.name}</span>
                    <i>
                      <b style={{ width: `${item.value}%` }} />
                    </i>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>
            </div>

            <article className="sample-mentor">
              <span>师父点评</span>
              <p>{active.mentor}</p>
            </article>

            <div className="sample-warning">{active.warning}</div>
            <button className="sample-primary sample-modal-action" type="button" onClick={() => setShowScore(false)}>
              退出查看模型 ›
            </button>
          </section>
        </div>
      )}
    </div>
  )
}
