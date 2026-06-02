import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import { SilkCloth } from '../three/SilkCloth'
import { useNav } from '../app/nav'
import { useGame } from '../app/GameState'
import './WorkshopScene.css'

const ROOM = 5 // room half-extent on x/z

/** WASD walk for the first-person camera, clamped inside the room. */
function FirstPersonMovement() {
  const { camera } = useThree()
  const keys = useRef<Set<string>>(new Set())
  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase())
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])
  useFrame((_, dt) => {
    const k = keys.current
    const fwd = new THREE.Vector3()
    camera.getWorldDirection(fwd)
    fwd.y = 0
    fwd.normalize()
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize()
    const move = new THREE.Vector3()
    if (k.has('w') || k.has('arrowup')) move.add(fwd)
    if (k.has('s') || k.has('arrowdown')) move.sub(fwd)
    if (k.has('d') || k.has('arrowright')) move.add(right)
    if (k.has('a') || k.has('arrowleft')) move.sub(right)
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(2.6 * Math.min(dt, 0.05))
      camera.position.add(move)
    }
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ROOM + 0.6, ROOM - 0.6)
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ROOM + 0.6, ROOM - 0.6)
    camera.position.y = 1.6
  })
  return null
}

function Room() {
  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM * 2, ROOM * 2]} />
        <meshStandardMaterial color="#6e5536" roughness={0.95} />
      </mesh>
      {/* ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 4, 0]}>
        <planeGeometry args={[ROOM * 2, ROOM * 2]} />
        <meshStandardMaterial color="#2e2418" roughness={1} />
      </mesh>
      {/* walls */}
      {(
        [
          [0, 2, -ROOM, 0],
          [0, 2, ROOM, Math.PI],
          [-ROOM, 2, 0, Math.PI / 2],
          [ROOM, 2, 0, -Math.PI / 2],
        ] as [number, number, number, number][]
      ).map(([x, y, z, ry], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, ry, 0]} receiveShadow>
          <planeGeometry args={[ROOM * 2, 4]} />
          <meshStandardMaterial color="#d8c8a8" roughness={0.96} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* ceiling beams */}
      {[-2.4, 0, 2.4].map((x) => (
        <mesh key={x} position={[x, 3.7, 0]} castShadow>
          <boxGeometry args={[0.22, 0.3, ROOM * 2]} />
          <meshStandardMaterial color="#46331f" roughness={0.9} />
        </mesh>
      ))}
      {/* a bright "window" on the back wall — reads as daylight pouring in */}
      <mesh position={[2.6, 2.1, -ROOM + 0.02]}>
        <planeGeometry args={[1.8, 2.2]} />
        <meshStandardMaterial color="#fff2d6" emissive="#ffe7b8" emissiveIntensity={1.6} />
      </mesh>
    </group>
  )
}

function DyeVat() {
  return (
    <group position={[0, 0, -1.8]}>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.72, 0.62, 0.84, 28]} />
        <meshStandardMaterial color="#2e2114" roughness={0.7} />
      </mesh>
      {/* dye surface */}
      <mesh position={[0, 0.82, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.64, 28]} />
        <meshStandardMaterial color="#4a2614" roughness={0.22} metalness={0.2} emissive="#2a130a" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

function ClothRack() {
  return (
    <group position={[2.4, 0, 1.2]} rotation={[0, -0.7, 0]}>
      {/* two posts + a top bar */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.1, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 2.8, 12]} />
          <meshStandardMaterial color="#4a3622" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 2.7, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 2.4, 12]} />
        <meshStandardMaterial color="#4a3622" roughness={0.9} />
      </mesh>
      {/* the hanging silk */}
      <group position={[0, 1.0, 0]} scale={0.42}>
        <SilkCloth textureUrl="/art/cloth-brown.png" />
      </group>
    </group>
  )
}

export function WorkshopScene() {
  const { go } = useNav()
  const { finishCraft } = useGame()
  const [locked, setLocked] = useState(false)

  // R3F's canvas can latch a stale size inside the transform-scaled <Stage>; nudge it.
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
    <div className="workshop-root">
      <Canvas
        className="workshop-canvas"
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        camera={{ position: [0, 1.6, 2.6], fov: 72 }}
      >
        <color attach="background" args={['#1a1109']} />
        <fog attach="fog" args={['#1a1109', 7, 18]} />

        <ambientLight intensity={0.3} />
        <directionalLight position={[3, 5, -2]} intensity={2.2} color="#ffe6c0" castShadow shadow-mapSize={[1024, 1024]} />
        <pointLight position={[0, 3.4, 0]} intensity={14} color="#ffcf8a" />
        <pointLight position={[2.5, 2, -4]} intensity={20} color="#fff0d0" />

        <Suspense fallback={null}>
          <Room />
          <DyeVat />
          <ClothRack />
        </Suspense>

        <PointerLockControls onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />
        <FirstPersonMovement />

        <EffectComposer>
          <Bloom intensity={0.45} luminanceThreshold={0.6} luminanceSmoothing={0.3} mipmapBlur />
          <Vignette eskil={false} offset={0.3} darkness={0.82} />
          <Noise opacity={0.03} premultiply />
        </EffectComposer>
      </Canvas>

      {!locked && (
        <div className="workshop-enter">
          <div className="workshop-enter-title">染 坊</div>
          <div className="workshop-enter-sub">点击进入第一人称 · WASD 走动 · 鼠标环顾 · ESC 退出</div>
        </div>
      )}

      <div className="workshop-hud">
        <button className="workshop-back" onClick={() => go('map')}>
          ‹ 离开工坊
        </button>
        <button
          className="workshop-finish"
          onClick={() => {
            void finishCraft()
            go('showcase3d')
          }}
        >
          完成制作 · 看成品 ›
        </button>
      </div>
    </div>
  )
}
