import { Abs } from './Abs'
import './TaskScroll.css'

/** Collapsed task scroll on the left edge — Figma 任务框收缩 (411x972). Simplified. */
export function TaskScroll({ x = 48, y = 81 }: { x?: number; y?: number }) {
  return (
    <Abs x={x} y={y} w={411} h={972} className="task-scroll">
      <div className="task-scroll-paper" />
      <div className="task-scroll-spine" />
      <div className="task-scroll-knob" />
    </Abs>
  )
}
