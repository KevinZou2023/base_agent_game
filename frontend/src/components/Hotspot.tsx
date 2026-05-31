import type { ReactNode } from 'react'
import { Abs } from './Abs'
import './Hotspot.css'

export interface HotspotProps {
  x: number
  y: number
  size?: number
  onClick?: () => void
  title?: string
  children?: ReactNode
}

/** A glowing, clickable spot on a scene (e.g. 晒莨 sun spots, 薯莨 harvest points,
 *  捞河泥 mud spots). */
export function Hotspot({ x, y, size = 233, onClick, title, children }: HotspotProps) {
  return (
    <Abs x={x} y={y} w={size} h={size} className="hotspot" onClick={onClick} title={title}>
      {children}
    </Abs>
  )
}
