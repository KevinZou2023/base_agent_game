import type { ReactNode } from 'react'
import { OrnateFrame } from './OrnateFrame'
import { STAGE_W, STAGE_H } from '../theme/tokens'
import './SceneRoot.css'

export interface SceneRootProps {
  /** Background painting URL (served from /public/art). */
  bg?: string
  /** How far the painting tucks under the ornate frame, in native px. */
  bgInset?: number
  /** Fill the interior with a cream parchment panel (for UI scenes). */
  paper?: boolean
  /** Override the paper colour. */
  paperColor?: string
  children?: ReactNode
}

/** Shared scene shell: walnut backing, an optional painting or parchment
 *  interior, scene content, then the ornate frame on top. */
export function SceneRoot({ bg, bgInset = 64, paper, paperColor, children }: SceneRootProps) {
  return (
    <div className="scene-root">
      {paper && (
        <div className="scene-paper" style={paperColor ? { background: paperColor } : undefined} />
      )}
      {bg && (
        <img
          className="scene-bg"
          src={bg}
          alt=""
          style={{
            left: bgInset,
            top: bgInset,
            width: STAGE_W - bgInset * 2,
            height: STAGE_H - bgInset * 2,
          }}
        />
      )}
      {children}
      <OrnateFrame />
    </div>
  )
}
