import { useEffect, useState, type ReactNode } from 'react'
import { STAGE_W, STAGE_H } from '../theme/tokens'
import './Stage.css'

/**
 * Renders a fixed logical canvas (STAGE_W x STAGE_H, the native Figma frame)
 * and scales it uniformly to fit the viewport, centered with letterbox bars.
 * All scene content is positioned in native Figma coordinates inside this box.
 */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(() => fitScale())

  useEffect(() => {
    const onResize = () => setScale(fitScale())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="stage-viewport">
      <div
        className="stage-canvas"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  )
}

function fitScale(): number {
  if (typeof window === 'undefined') return 1
  return Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H)
}
