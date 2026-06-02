import { Abs } from './Abs'
import './Character.css'

const W = 86
const H = 192

/** Roaming avatar / NPC — a hand-painted chibi sprite anchored at its feet (x,y).
 *  `facing` mirrors L/R. Bob: pass `bobY` (px) for a JS step-bounce locked to the
 *  walk loop's travelled distance; otherwise `walking` runs a gentle CSS bob (NPCs). */
export function Character({
  x,
  y,
  walking,
  facing = 'right',
  sprite,
  bobY,
}: {
  x: number
  y: number
  walking?: boolean
  facing?: 'left' | 'right'
  sprite: string
  bobY?: number
}) {
  const jsBob = typeof bobY === 'number'
  // shadow tightens as the body lifts off the ground — sells each footfall
  const shadowScale = jsBob ? Math.max(0.72, 1 - bobY / 26) : 1
  return (
    <Abs x={x - W / 2} y={y - H} w={W} h={H} className={`character${walking && !jsBob ? ' is-walking' : ''}`}>
      <div
        className="character-shadow"
        style={jsBob ? { transform: `translateX(-50%) scale(${shadowScale})` } : undefined}
      />
      <div className="character-flip" style={{ transform: `scaleX(${facing === 'left' ? -1 : 1})` }}>
        <div className="character-bob" style={jsBob ? { transform: `translateY(${-bobY}px)` } : undefined}>
          <img className="character-sprite" src={sprite} alt="" draggable={false} />
        </div>
      </div>
    </Abs>
  )
}
