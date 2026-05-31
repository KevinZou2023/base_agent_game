import type { CSSProperties, ReactNode, MouseEventHandler } from 'react'

export interface AbsProps {
  x: number
  y: number
  w?: number
  h?: number
  className?: string
  style?: CSSProperties
  onClick?: MouseEventHandler<HTMLDivElement>
  title?: string
  children?: ReactNode
}

/** Absolutely-positioned box in native Figma stage coordinates (3148 x 1773). */
export function Abs({ x, y, w, h, className, style, onClick, title, children }: AbsProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      title={title}
      style={{ position: 'absolute', left: x, top: y, width: w, height: h, ...style }}
    >
      {children}
    </div>
  )
}
