import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, ContactShadows } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import { SilkCloth } from '../three/SilkCloth'
import { AIInsightOverlay } from '../components/AIInsightOverlay'
import { useNav } from '../app/nav'
import './Showcase3DScene.css'

/**
 * P0 hero slice — the 3D showcase.
 *
 * A single bolt of 香云纱 hangs in a dark, spotlit space, slowly turning on a
 * cinematic turntable. The silk wears a (placeholder) AI texture; an ink-wash
 * post stack (bloom + vignette + film grain) gives it the 水墨 mood. Beside it,
 * <AIInsightOverlay> replays a captured MasterAgent run as the technical hammer.
 */
export function Showcase3DScene() {
  const { go } = useNav()

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
          <SilkCloth textureUrl="/art/cloth-brown.png" />
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
    </div>
  )
}
