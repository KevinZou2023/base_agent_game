import { useEffect, useRef, useState } from 'react'
import { Abs } from './Abs'
import './TimingSpot.css'

export interface TimingResult {
  q: number
  label: string
}

interface TimingSpotProps {
  x: number
  y: number
  size?: number
  idleHint: string
  activeHint: string
  variant?: 'tuber' | 'mud' | 'cloth'
  /** Resolve the swept value (0..1) into a quality + label. */
  resolve: (val: number) => TimingResult
  onResult: (r: TimingResult) => void
  disabled?: boolean
}

/** Reusable timing mini-game: tap to start → a marker sweeps a gauge with a
 *  正熟/最佳 sweet zone → tap again to capture. Used by 采薯莨 / 过滤 / 晒莨. */
export function TimingSpot({
  x,
  y,
  size = 233,
  idleHint,
  activeHint,
  variant = 'tuber',
  resolve,
  onResult,
  disabled,
}: TimingSpotProps) {
  const [phase, setPhase] = useState<'idle' | 'active' | 'done'>('idle')
  const [val, setVal] = useState(0.5)
  const valRef = useRef(0.5)
  const [pop, setPop] = useState<string | null>(null)

  useEffect(() => {
    if (phase !== 'active') return
    let raf = 0
    const loop = (t: number) => {
      const v = (Math.sin(t / 360) + 1) / 2
      valRef.current = v
      setVal(v)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  const click = () => {
    if (disabled) return
    if (phase === 'idle') {
      setPhase('active')
    } else if (phase === 'active') {
      const r = resolve(valRef.current)
      setPhase('done')
      setPop(r.label)
      onResult(r)
      window.setTimeout(() => setPop(null), 1200)
    }
  }

  return (
    <Abs x={x} y={y} w={size} h={size} className={`tspot tspot-${phase}${disabled ? ' tspot-disabled' : ''}`} onClick={click}>
      {phase !== 'done' && <div className="tspot-glow" />}
      {phase === 'idle' && <div className={`tspot-icon tspot-${variant}`} />}
      {phase === 'done' && <div className="tspot-dug" />}

      {phase === 'active' && (
        <div className="tspot-gauge">
          <div className="tspot-sweet" />
          <div className="tspot-marker" style={{ left: `${val * 100}%` }} />
        </div>
      )}

      {phase === 'idle' && <div className="tspot-hint">{idleHint}</div>}
      {phase === 'active' && <div className="tspot-hint tspot-hint-go">{activeHint}</div>}
      {pop && <div className="tspot-pop">+{pop}</div>}
    </Abs>
  )
}
