import { Abs } from './Abs'
import './Character.css'

const W = 116
const H = 168

/** Roaming avatar — a chibi 香云纱 apprentice girl anchored at her feet (x,y).
 *  `facing` flips L/R; `walking` drives a limb walk-cycle (see Character.css). */
export function Character({
  x,
  y,
  walking,
  facing = 'right',
}: {
  x: number
  y: number
  walking?: boolean
  facing?: 'left' | 'right'
}) {
  return (
    <Abs x={x - W / 2} y={y - H} w={W} h={H} className={`character${walking ? ' is-walking' : ''}`}>
      <div className="character-inner" style={{ transform: `scaleX(${facing === 'left' ? -1 : 1})` }}>
        <svg viewBox="0 0 100 150" width={W} height={H} aria-hidden>
          <ellipse className="ch-shadow" cx="50" cy="147" rx="22" ry="5" fill="rgba(30,20,10,0.26)" />
          <g className="ch-bob">
            {/* legs */}
            <g className="ch-leg ch-leg-l">
              <rect x="41" y="110" width="8" height="28" rx="4" fill="#3b2c1c" />
              <ellipse cx="45" cy="139" rx="7" ry="4" fill="#241a10" />
            </g>
            <g className="ch-leg ch-leg-r">
              <rect x="51" y="110" width="8" height="28" rx="4" fill="#3b2c1c" />
              <ellipse cx="55" cy="139" rx="7" ry="4" fill="#241a10" />
            </g>
            {/* arms (sleeves) */}
            <g className="ch-arm ch-arm-l">
              <rect x="27" y="79" width="9" height="26" rx="4.5" fill="#8a4528" />
              <circle cx="31.5" cy="105" r="5" fill="#f3ddc2" />
            </g>
            <g className="ch-arm ch-arm-r">
              <rect x="64" y="79" width="9" height="26" rx="4.5" fill="#8a4528" />
              <circle cx="68.5" cy="105" r="5" fill="#f3ddc2" />
            </g>
            {/* torso — gambier-brown jacket */}
            <path d="M33 79 Q50 71 67 79 L63 115 Q50 121 37 115 Z" fill="#9c4f30" />
            <path d="M33 79 Q50 71 67 79 L65 90 Q50 84 35 90 Z" fill="#b15c39" />
            {/* wrap collar */}
            <path d="M50 73 L41 80 L47 101 L50 93 L53 101 L59 80 Z" fill="#ecdec4" />
            {/* sash */}
            <rect x="36" y="99" width="28" height="8" rx="3" fill="#6f3a22" />
            <rect x="47" y="99" width="6" height="20" rx="2" fill="#6f3a22" />
            {/* head */}
            <circle cx="50" cy="49" r="24" fill="#f3ddc2" />
            {/* hair: back, bun, sides, bangs */}
            <path d="M26 50 Q24 20 50 18 Q76 20 74 50 Q68 31 50 30 Q32 31 26 50 Z" fill="#2a2018" />
            <circle cx="50" cy="16" r="8.5" fill="#2a2018" />
            <circle cx="50" cy="14.5" r="3" fill="#b5472f" />
            <path d="M26 47 Q25 64 32 70 L34 50 Z" fill="#2a2018" />
            <path d="M74 47 Q75 64 68 70 L66 50 Z" fill="#2a2018" />
            <path d="M29 37 Q50 23 71 37 Q63 31 50 31 Q37 31 29 37 Z" fill="#2a2018" />
            {/* face */}
            <circle cx="42" cy="51" r="2.6" fill="#3a2a1c" />
            <circle cx="58" cy="51" r="2.6" fill="#3a2a1c" />
            <circle cx="42.8" cy="50.2" r="0.8" fill="#fff" />
            <circle cx="58.8" cy="50.2" r="0.8" fill="#fff" />
            <ellipse cx="36" cy="57" rx="3.4" ry="2.1" fill="#e89a86" opacity="0.6" />
            <ellipse cx="64" cy="57" rx="3.4" ry="2.1" fill="#e89a86" opacity="0.6" />
            <path d="M46 58 Q50 62 54 58" stroke="#a85a3a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>
        </svg>
      </div>
    </Abs>
  )
}
