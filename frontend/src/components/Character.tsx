import { Abs } from './Abs'
import './Character.css'

const W = 86
const H = 192

/** Roaming avatar / NPC — a hand-painted chibi sprite anchored at its feet (x,y).
 *  `facing` mirrors L/R; `walking` drives a gentle bob. */
export function Character({
  x,
  y,
  walking,
  facing = 'right',
  sprite,
}: {
  x: number
  y: number
  walking?: boolean
  facing?: 'left' | 'right'
  sprite: string
}) {
  return (
    <Abs x={x - W / 2} y={y - H} w={W} h={H} className={`character${walking ? ' is-walking' : ''}`}>
      <div className="character-shadow" />
      <div className="character-flip" style={{ transform: `scaleX(${facing === 'left' ? -1 : 1})` }}>
        <div className="character-bob">
          <img className="character-sprite" src={sprite} alt="" draggable={false} />
        </div>
      </div>
    </Abs>
  )
}
