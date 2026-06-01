import { useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'

interface SilkClothProps {
  /** Texture used as the silk's surface — later swapped for a 通义万相 bake. */
  textureUrl: string
  width?: number
  height?: number
}

/**
 * A hanging length of 香云纱 silk.
 *
 * The geometry is a high-segment plane displaced into soft vertical folds,
 * pinned (flat) at the top and billowing toward the bottom, so it reads as a
 * bolt of cloth left to hang. A MeshPhysicalMaterial with sheen + clearcoat
 * gives the characteristic 正面乌黑透亮 / 背面棕红 shimmer as light sweeps across
 * the folds while the camera orbits.
 */
export function SilkCloth({ textureUrl, width = 3.3, height = 4.5 }: SilkClothProps) {
  const map = useLoader(THREE.TextureLoader, textureUrl)
  const groupRef = useRef<THREE.Group>(null)

  // Build the draped plane once. Folds = sum of sines across X, tapered by a
  // top-to-bottom factor so the pinned top edge stays flat.
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, height, 64, 96)
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const ty = (height / 2 - y) / height // 0 at top → 1 at bottom
      const fold =
        Math.sin(x * 3.1) * 0.17 +
        Math.sin(x * 6.7 + 1.3) * 0.07 +
        Math.sin(x * 1.7 - 0.6) * 0.11
      pos.setZ(i, fold * Math.pow(ty, 0.7))
    }
    geo.computeVertexNormals()
    return geo
  }, [width, height])

  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 8
  }, [map])

  // Gentle life: a slow yaw sway + a faint vertical breathe.
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.08
      groupRef.current.rotation.z = Math.sin(t * 0.45) * 0.018
      groupRef.current.position.y = Math.sin(t * 0.6) * 0.04
    }
  })

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          map={map}
          side={THREE.DoubleSide}
          roughness={0.4}
          metalness={0.06}
          sheen={1}
          sheenRoughness={0.35}
          sheenColor="#caa06a"
          clearcoat={0.55}
          clearcoatRoughness={0.45}
          emissive="#3a1f12"
          emissiveIntensity={0.12}
          envMapIntensity={0.7}
        />
      </mesh>
    </group>
  )
}
