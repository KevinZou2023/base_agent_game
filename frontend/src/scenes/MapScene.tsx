import { useEffect, useRef, useState } from 'react'
import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { Character } from '../components/Character'
import { TopStatusBar } from '../components/TopStatusBar'
import { NavTabs } from '../components/NavTabs'
import { BackButton } from '../components/BackButton'
import { TaskScroll } from '../components/TaskScroll'
import { useNav, type SceneId } from '../app/nav'
import { useGame } from '../app/GameState'
import { STAGE_W, STAGE_H } from '../theme/tokens'
import './MapScene.css'

// ── tunables (tweak these after play-testing) ─────────────────────────
const ZOOM = 2.0 // camera zoom — bigger = closer / more Stardew
const SPEED = 8 // character px per frame (figma coords)
const EASE = 0.12 // camera follow smoothing (0..1, smaller = lazier)
const INTERACT_R = 360 // proximity radius to trigger "press E"
// ──────────────────────────────────────────────────────────────────────

const MAP = { x: 64, y: 64, w: STAGE_W - 128, h: STAGE_H - 128 } // painting bounds
const START = { x: 1500, y: 1320 }

// On-map locations — exact group positions from Figma node 1:773.
const LOCATIONS: { label: string; x: number; y: number; to: SceneId }[] = [
  { label: '村庄', x: 463, y: 255, to: 'village' },
  { label: '乌尔河', x: 856, y: 350, to: 'river' },
  { label: '仓库', x: 1005, y: 738, to: 'warehouse' },
  { label: '师父的家', x: 1621, y: 317, to: 'master' },
  { label: '空间', x: 2104, y: 501, to: 'space' },
  { label: '织布坊', x: 2098, y: 1210, to: 'weaving' },
  { label: '晾晒场', x: 2795, y: 352, to: 'drying' },
  { label: '染坊', x: 2829, y: 906, to: 'dye' },
  { label: '青翠山', x: 314, y: 1083, to: 'mountain' },
]

// ── walkable geometry (logical coords) — calibrate live with the P overlay ──
const WALK_POLY: [number, number][] = [
  [840, 660],
  [1560, 575],
  [2430, 600],
  [2950, 850],
  [2950, 1200],
  [2250, 1580],
  [1300, 1570],
  [840, 1260],
]
const POND = { cx: 1548, cy: 1019, rx: 360, ry: 185 }
const BLOCKS: [number, number, number, number][] = [
  [845, 700, 1360, 1150], // 仓库 (big left building)
  [1740, 1230, 2260, 1505], // 织布坊 (bottom-mid building)
  [2660, 600, 2950, 1170], // right building cluster (空间 / 染坊)
  [1470, 560, 1900, 705], // 师父的家 (top-mid building)
]

const ptInPoly = (x: number, y: number): boolean => {
  let inside = false
  for (let i = 0, j = WALK_POLY.length - 1; i < WALK_POLY.length; j = i++) {
    const [xi, yi] = WALK_POLY[i]
    const [xj, yj] = WALK_POLY[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const inPond = (x: number, y: number) => {
  const dx = (x - POND.cx) / POND.rx
  const dy = (y - POND.cy) / POND.ry
  return dx * dx + dy * dy < 1
}
const inBlock = (x: number, y: number) => BLOCKS.some(([x0, y0, x1, y1]) => x > x0 && x < x1 && y > y0 && y < y1)
const walkable = (x: number, y: number) => ptInPoly(x, y) && !inPond(x, y) && !inBlock(x, y)

const WEATHER: Record<string, { weather: string; temp: string; auspicious: string; overlay?: string }> = {
  map: { weather: '晴朗', temp: '26°C', auspicious: '晒布' },
  mapCloudy: { weather: '多云', temp: '24°C', auspicious: '晾晒', overlay: 'cloudy' },
  mapRainy: { weather: '阴雨', temp: '21°C', auspicious: '休整', overlay: 'rainy' },
}
const ORDER: SceneId[] = ['map', 'mapCloudy', 'mapRainy']

const clamp = (v: number, lo: number, hi: number) => (hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)))

type Loc = (typeof LOCATIONS)[number]

/** 地图 — Stardew-style walkable overworld: WASD/方向键 to roam the courtyard
 *  (constrained to the paved ground), camera follows, press E at a building to enter. */
export function MapScene() {
  const { scene, go } = useNav()
  const { setWeather } = useGame()
  const w = WEATHER[scene] ?? WEATHER.map
  const next = ORDER[(Math.max(0, ORDER.indexOf(scene)) + 1) % ORDER.length]

  useEffect(() => {
    setWeather(scene === 'mapRainy' ? 'rainy' : scene === 'mapCloudy' ? 'cloudy' : 'sunny')
  }, [scene, setWeather])

  const [pos, setPos] = useState(START)
  const [cam, setCam] = useState(START)
  const [facing, setFacing] = useState<'left' | 'right'>('right')
  const [moving, setMoving] = useState(false)
  const [near, setNear] = useState<Loc | null>(null)
  const [debug, setDebug] = useState(false)

  const posRef = useRef(START)
  const camRef = useRef(START)
  const keys = useRef<Set<string>>(new Set())
  const nearRef = useRef<Loc | null>(null)
  const goRef = useRef(go)
  goRef.current = go

  // keyboard input
  useEffect(() => {
    const MOVE = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (MOVE.includes(k)) {
        keys.current.add(k)
        e.preventDefault()
      } else if (k === 'e' || k === ' ' || k === 'enter') {
        const n = nearRef.current
        if (n) goRef.current(n.to)
      } else if (k === 'p') {
        setDebug((d) => !d)
      }
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // movement + camera game loop
  useEffect(() => {
    const halfW = STAGE_W / 2 / ZOOM
    const halfH = STAGE_H / 2 / ZOOM
    let raf = 0
    const step = () => {
      const k = keys.current
      let vx = 0
      let vy = 0
      if (k.has('w') || k.has('arrowup')) vy -= 1
      if (k.has('s') || k.has('arrowdown')) vy += 1
      if (k.has('a') || k.has('arrowleft')) vx -= 1
      if (k.has('d') || k.has('arrowright')) vx += 1

      let p = posRef.current
      const isMoving = vx !== 0 || vy !== 0
      if (isMoving) {
        const len = Math.hypot(vx, vy) || 1
        const nx = p.x + (vx / len) * SPEED
        const ny = p.y + (vy / len) * SPEED
        // try full move, then slide along a single axis if blocked
        if (walkable(nx, ny)) p = { x: nx, y: ny }
        else if (walkable(nx, p.y)) p = { x: nx, y: p.y }
        else if (walkable(p.x, ny)) p = { x: p.x, y: ny }
        posRef.current = p
        setPos(p)
        if (vx < 0) setFacing('left')
        else if (vx > 0) setFacing('right')
      }
      setMoving(isMoving)

      // nearest enterable location (door point sits a bit below the label)
      let best: Loc | null = null
      let bestD = INTERACT_R
      for (const l of LOCATIONS) {
        const d = Math.hypot(l.x + 75 - p.x, l.y + 220 - p.y)
        if (d < bestD) {
          bestD = d
          best = l
        }
      }
      if (best !== nearRef.current) {
        nearRef.current = best
        setNear(best)
      }

      // camera eases toward the character, clamped to the painting
      const c = camRef.current
      const tx = clamp(p.x, MAP.x + halfW, MAP.x + MAP.w - halfW)
      const ty = clamp(p.y, MAP.y + halfH, MAP.y + MAP.h - halfH)
      const nc = { x: c.x + (tx - c.x) * EASE, y: c.y + (ty - c.y) * EASE }
      camRef.current = nc
      setCam(nc)

      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  const worldTransform = `translate(${STAGE_W / 2 - cam.x * ZOOM}px, ${STAGE_H / 2 - cam.y * ZOOM}px) scale(${ZOOM})`

  return (
    <SceneRoot>
      <Abs x={0} y={0} w={STAGE_W} h={STAGE_H} className="map-viewport">
        <div className="map-world" style={{ width: STAGE_W, height: STAGE_H, transform: worldTransform }}>
          <img
            className="map-bg"
            src="/art/bg-map.png"
            alt=""
            style={{ left: MAP.x, top: MAP.y, width: MAP.w, height: MAP.h }}
          />

          {debug && (
            <svg className="map-debug" viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} width={STAGE_W} height={STAGE_H}>
              <polygon
                points={WALK_POLY.map((p) => p.join(',')).join(' ')}
                fill="rgba(70,210,120,0.18)"
                stroke="#46d27a"
                strokeWidth={5}
              />
              <ellipse cx={POND.cx} cy={POND.cy} rx={POND.rx} ry={POND.ry} fill="rgba(224,80,80,0.28)" stroke="#e05050" strokeWidth={5} />
              {BLOCKS.map(([x0, y0, x1, y1], i) => (
                <rect key={i} x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="rgba(224,80,80,0.22)" stroke="#e05050" strokeWidth={5} />
              ))}
              <circle cx={pos.x} cy={pos.y} r={12} fill="#ffd400" />
            </svg>
          )}

          {LOCATIONS.map((l) => (
            <Abs
              key={l.label}
              x={l.x}
              y={l.y}
              w={150}
              h={170}
              className={`map-loc${near?.label === l.label ? ' is-near' : ''}`}
            >
              <span className="map-loc-pin" />
              <span className="map-loc-label">{l.label}</span>
            </Abs>
          ))}
          <Character x={pos.x} y={pos.y} walking={moving} facing={facing} />
        </div>

        {w.overlay && <Abs x={0} y={0} w={STAGE_W} h={STAGE_H} className={`weather-overlay weather-${w.overlay}`} />}
      </Abs>

      {near && (
        <div className="map-prompt">
          <kbd>E</kbd> 进入 · {near.label}
        </div>
      )}
      <div className="map-help">WASD / 方向键 移动 · 走近建筑按 E 进入{debug ? ' · [P] 调试中' : ''}</div>
      <button className="map-weather-toggle" onClick={() => go(next)}>
        天气 · {w.weather}
      </button>

      <TopStatusBar weather={w.weather} temp={w.temp} auspicious={w.auspicious} />
      <TaskScroll x={48} y={81} />
      <NavTabs />
      <BackButton onClick={() => go('start')} />
    </SceneRoot>
  )
}
