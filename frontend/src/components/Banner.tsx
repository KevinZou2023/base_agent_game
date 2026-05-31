import { Abs } from './Abs'
import './Banner.css'

export interface BannerProps {
  label: string
  x: number
  y: number
  onClick?: () => void
}

/** Ink-blob location label on the map — vertical brush text on a dark lozenge.
 *  Figma location groups are ~149x355 (e.g. 村庄 @463,255). */
export function Banner({ label, x, y, onClick }: BannerProps) {
  return (
    <Abs x={x} y={y} w={149} h={355}>
      <button type="button" className="map-banner" onClick={onClick}>
        <span className="map-banner-text">{label}</span>
      </button>
    </Abs>
  )
}
