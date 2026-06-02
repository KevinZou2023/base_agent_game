import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, ContactShadows } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import { SilkCloth } from '../three/SilkCloth'
import { AIInsightOverlay } from '../components/AIInsightOverlay'
import { useNav } from '../app/nav'
import { useGame } from '../app/GameState'
import { scoreTotal } from '../api/types'
import './Showcase3DScene.css'

/**
 * P0 hero slice — the 3D showcase.
 *
 * A single bolt of 香云纱 hangs in a dark, spotlit space, slowly turning on a
 * cinematic turntable. The silk wears a (placeholder) AI texture; an ink-wash
 * post stack (bloom + vignette + film grain) gives it the 水墨 mood. Beside it,
 * <AIInsightOverlay> replays a captured MasterAgent run as the technical hammer.
 */
const DIMS = [
  { key: 'process_score', label: '工艺' },
  { key: 'pattern_score', label: '纹样' },
  { key: 'color_score', label: '色彩' },
  { key: 'culture_score', label: '文化' },
  { key: 'progress_score', label: '进步' },
] as const

const LOADING_LINES = [
  '薯莨汁反复浸染……',
  '烈日之下，暴晒成色……',
  '河泥过乌，氧化生黑……',
  '清水漂洗，晾于竹竿……',
  '通义万相 · 落笔成纹……',
]

export function Showcase3DScene() {
  const { go } = useNav()
  const { generating, genMocked, genError, currentArtwork, currentScoring } = useGame()
  const [showResult, setShowResult] = useState(true)
  const [flavor, setFlavor] = useState(0)
  const lastScoredId = useRef<string | null>(null)

  // Re-open the result card whenever a fresh scoring arrives.
  useEffect(() => {
    if (currentScoring && currentScoring.artwork_id !== lastScoredId.current) {
      lastScoredId.current = currentScoring.artwork_id
      setShowResult(true)
    }
  }, [currentScoring])

  // Cycle craft-flavored status lines while 通义万相 is generating.
  useEffect(() => {
    if (!generating) return
    const t = window.setInterval(() => setFlavor((f) => (f + 1) % LOADING_LINES.length), 1300)
    return () => window.clearInterval(t)
  }, [generating])

  const textureUrl = currentArtwork?.image_url ?? '/art/cloth-brown.png'

  // R3F's react-use-measure can latch onto a 0/stale size when this scene mounts
  // into the transform-scaled <Stage>, leaving the canvas at its 300×150 default.
  // Nudge a re-measure after first paint so it fills the stage at the right aspect.
  useEffect(() => {
    const fire = () => window.dispatchEvent(new Event('resize'))
    const r = requestAnimationFrame(fire)
    const t = window.setTimeout(fire, 120)
    return () => {
      cancelAnimationFrame(r)
      window.clearTimeout(t)
    }
  }, [])

  return (
    <div className="show3d-root">
      <Canvas
        className="show3d-canvas"
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        camera={{ position: [0, 0.15, 7.2], fov: 40 }}
      >
        <color attach="background" args={['#0b0806']} />
        <fog attach="fog" args={['#0b0806', 8, 18]} />

        <ambientLight intensity={0.16} />
        <spotLight
          position={[5, 7, 6]}
          angle={0.5}
          penumbra={0.85}
          intensity={220}
          color="#fff1dc"
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <spotLight position={[-6, 2, 4]} angle={0.6} penumbra={1} intensity={90} color="#b86a3a" />
        <pointLight position={[0, -1, -5]} intensity={55} color="#7a4a2a" />

        <Suspense fallback={null}>
          <SilkCloth textureUrl={textureUrl} />
          <ContactShadows position={[0, -2.55, 0]} opacity={0.5} scale={13} blur={2.6} far={4} color="#160a04" />
          <Environment resolution={256} background={false}>
            <Lightformer intensity={2.4} color="#f0c08a" position={[0, 3, -4]} scale={[9, 9, 1]} />
            <Lightformer intensity={1} color="#6b4426" position={[-4, 0, 3]} scale={[5, 5, 1]} />
            <Lightformer intensity={1.4} color="#ffe9c8" position={[4, 1, 2]} scale={[3, 6, 1]} />
          </Environment>
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.5}
          minPolarAngle={Math.PI * 0.36}
          maxPolarAngle={Math.PI * 0.6}
        />

        <EffectComposer>
          <Bloom intensity={0.55} luminanceThreshold={0.55} luminanceSmoothing={0.3} mipmapBlur />
          <Vignette eskil={false} offset={0.28} darkness={0.82} />
          <Noise opacity={0.035} premultiply />
        </EffectComposer>
      </Canvas>

      <div className="show3d-title">
        <div className="show3d-title-cn">香云纱</div>
        <div className="show3d-title-sub">GAMBIERED CANTON GAUZE · 国家级非物质文化遗产</div>
      </div>

      <div className="show3d-knowledge">
        <div className="show3d-knowledge-k">知 识 卡</div>
        <p>
          以薯莨汁反复浸染、河泥「过乌」氧化成色，<b>正面乌黑透亮、背面棕红</b>，
          一匹需历经数十道工序、半年日晒，被称为「软黄金」。
        </p>
      </div>

      <AIInsightOverlay />

      <button className="show3d-back" onClick={() => go('map')}>
        ‹ 返回
      </button>

      {generating && (
        <div className="show3d-veil">
          <div className="show3d-loading">
            <div className="show3d-spinner" />
            <div className="show3d-loading-title">师父正在为你成衣……</div>
            <div className="show3d-loading-sub">{LOADING_LINES[flavor]}</div>
            <div className="show3d-loading-tip">通义万相 正按你的工艺参数生成专属纹样</div>
          </div>
        </div>
      )}

      {!generating && genError && (
        <div className="show3d-veil">
          <div className="show3d-loading">
            <div className="show3d-loading-title">成衣未成</div>
            <div className="show3d-loading-sub">{genError}</div>
            <button className="show3d-result-confirm" onClick={() => go('weaving')}>
              回工坊重试 ›
            </button>
          </div>
        </div>
      )}

      {!generating && !genError && currentScoring && showResult && (
        <div className="show3d-veil">
          <div className="show3d-result" role="dialog" aria-modal="true">
            <div className="show3d-result-head">
              <span className="show3d-result-kicker">成 衣 完 成</span>
              {genMocked && <span className="show3d-result-mock">离线示范</span>}
            </div>

            <div className="show3d-result-score">
              <div className="show3d-result-total">
                <span className="show3d-result-total-num">{Math.round(scoreTotal(currentScoring.scores))}</span>
                <span className="show3d-result-total-unit">总评</span>
              </div>
              <div className="show3d-result-bars">
                {DIMS.map((d) => {
                  const v = currentScoring.scores[d.key]
                  return (
                    <div className="show3d-bar" key={d.key}>
                      <span className="show3d-bar-label">{d.label}</span>
                      <span className="show3d-bar-track">
                        <span className="show3d-bar-fill" style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
                      </span>
                      <span className="show3d-bar-val">{v}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="show3d-result-feedback">
              <span className="show3d-result-by">师父点评</span>
              <p>{currentScoring.master_feedback}</p>
            </div>

            {currentScoring.deductions.length > 0 && (
              <div className="show3d-result-deduct">
                {currentScoring.deductions.map((d, i) => (
                  <span className="show3d-deduct" key={i}>
                    ⚠ {d.dimension} −{d.points} · {d.reason}
                  </span>
                ))}
              </div>
            )}

            {currentScoring.next_task_recommendation && (
              <div className="show3d-result-next">下一关 · {currentScoring.next_task_recommendation}</div>
            )}

            <button className="show3d-result-confirm" onClick={() => setShowResult(false)}>
              收下这匹香云纱 ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
