import { useEffect, useMemo, useRef, useState } from 'react'
import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { Character } from '../components/Character'
import { TopStatusBar } from '../components/TopStatusBar'
import { NavTabs } from '../components/NavTabs'
import { BackButton } from '../components/BackButton'
import { QuestTracker } from '../components/QuestTracker'
import { NpcDialogue } from '../components/NpcDialogue'
import { GOLDEN_PATH, loadQuestStep, saveQuestStep } from '../app/quest'
import { useNav, type SceneId } from '../app/nav'
import { useGame } from '../app/GameState'
import { STAGE_W, STAGE_H } from '../theme/tokens'
import './MapScene.css'

// ── tunables (tweak after play-testing) ──
const ZOOM = 2.0
const SPEED = 5
const EASE = 0.12
const INTERACT_R = 400

const MAP = { x: 64, y: 64, w: STAGE_W - 128, h: STAGE_H - 128 }
const START = { x: 1500, y: 1320 }

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

// NPCs — hand-painted sprites cropped from villager-popo.png
interface Npc {
  id: string
  name: string
  x: number
  y: number
  sprite: string
  giver?: boolean
  lines: { before: string[]; after: string[] }
}
const NPCS: Npc[] = [
  {
    id: 'granny',
    name: '阿婆',
    x: 1350,
    y: 1255,
    sprite: '/art/npc_popo.png',
    giver: true,
    lines: {
      before: [
        '后生仔,你是来学香云纱的吧?',
        '这门手艺,三分料七分晒,急不得。',
        '先去拜会村中的师父——就在村子中间那座大屋。去吧!',
      ],
      after: ['学艺顺顺当当啊,后生。', '记住:薯莨反复浸染、河泥过乌、烈日暴晒,缺一不可。'],
    },
  },
  {
    id: 'yeye',
    name: '老爷爷',
    x: 1780,
    y: 820,
    sprite: '/art/npc_yeye.png',
    lines: {
      before: ['这池水通着乌尔河,过乌就靠它的河泥哟。', '后生,香云纱晒足了日头,正面才会乌黑发亮。'],
      after: ['好好学,这门老手艺,就靠你们后生传下去咯。'],
    },
  },
]

// ── walkable geometry (logical coords) — user-defined, calibrate with P overlay ──
// Generous central courtyard, MINUS the pond & building footprints. Only the big
// obstacles are blocked, so movement stays smooth (never pinched on trees/specks).
const GRID_W = 252
const GRID_H = 140
const BOUND: [number, number][] = [
  [660, 440],
  [2740, 430],
  [3030, 720],
  [3030, 1310],
  [2500, 1585],
  [1230, 1620],
  [780, 1370],
  [580, 840],
]
const POND = { cx: 1650, cy: 1035, rx: 315, ry: 150 }
const BUILDINGS: [number, number, number, number][] = [
  [120, 240, 660, 560], // 村庄 (top-left cluster)
  [1430, 430, 1710, 690], // 师父家 (top-mid)
  [820, 820, 1160, 1110], // big left-mid building
  [2130, 665, 2450, 1045], // right-mid cluster
  [1650, 1280, 1925, 1465], // 织布坊 (bottom-mid)
  [2640, 1010, 2890, 1310], // far-right building
  [2340, 260, 2820, 560], // top-right farm
]
const inBound = (x: number, y: number): boolean => {
  let inside = false
  for (let i = 0, j = BOUND.length - 1; i < BOUND.length; j = i++) {
    const [xi, yi] = BOUND[i]
    const [xj, yj] = BOUND[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const walkable = (x: number, y: number): boolean => {
  if (!inBound(x, y)) return false
  const dx = (x - POND.cx) / POND.rx
  const dy = (y - POND.cy) / POND.ry
  if (dx * dx + dy * dy < 1) return false
  for (const [x0, y0, x1, y1] of BUILDINGS) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return false
  return true
}
function buildDebugOverlay(): string | null {
  try {
    const cv = document.createElement('canvas')
    cv.width = GRID_W
    cv.height = GRID_H
    const ctx = cv.getContext('2d')
    if (!ctx) return null
    const im = ctx.createImageData(GRID_W, GRID_H)
    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        const lx = MAP.x + ((gx + 0.5) / GRID_W) * MAP.w
        const ly = MAP.y + ((gy + 0.5) / GRID_H) * MAP.h
        const ok = walkable(lx, ly)
        const i = (gy * GRID_W + gx) * 4
        im.data[i] = ok ? 70 : 224
        im.data[i + 1] = ok ? 210 : 80
        im.data[i + 2] = ok ? 120 : 80
        im.data[i + 3] = 130
      }
    }
    ctx.putImageData(im, 0, 0)
    return cv.toDataURL()
  } catch {
    return null
  }
}

const WEATHER: Record<string, { weather: string; temp: string; auspicious: string; overlay?: string }> = {
  map: { weather: '晴朗', temp: '26°C', auspicious: '晒布' },
  mapCloudy: { weather: '多云', temp: '24°C', auspicious: '晾晒', overlay: 'cloudy' },
  mapRainy: { weather: '阴雨', temp: '21°C', auspicious: '休整', overlay: 'rainy' },
}
const ORDER: SceneId[] = ['map', 'mapCloudy', 'mapRainy']
const clamp = (v: number, lo: number, hi: number) => (hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)))

type Near = { kind: 'loc'; loc: (typeof LOCATIONS)[number] } | { kind: 'npc'; npc: Npc } | null

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
  const [near, setNear] = useState<Near>(null)
  const [debug, setDebug] = useState(false)
  const [questStep, setQuestStep] = useState<number>(() => loadQuestStep())
  const [talking, setTalking] = useState<Npc | null>(null)
  const [talkLine, setTalkLine] = useState(0)

  const posRef = useRef(START)
  const camRef = useRef(START)
  const keys = useRef<Set<string>>(new Set())
  const nearRef = useRef<Near>(null)
  const goRef = useRef(go)
  const questStepRef = useRef(questStep)
  const talkingRef = useRef<Npc | null>(null)
  const talkLineRef = useRef(0)
  const advanceRef = useRef<() => void>(() => {})
  goRef.current = go
  questStepRef.current = questStep
  talkingRef.current = talking
  talkLineRef.current = talkLine

  useEffect(() => saveQuestStep(questStep), [questStep])

  // debug overlay (press P) — built once from the explicit walkable geometry
  const debugUrl = useMemo(() => buildDebugOverlay(), [])

  // advance / close NPC dialogue
  const advance = () => {
    const npc = talkingRef.current
    if (!npc) return
    const lines = questStepRef.current >= 0 ? npc.lines.after : npc.lines.before
    if (talkLineRef.current < lines.length - 1) {
      setTalkLine((l) => l + 1)
    } else {
      const wasGiverIntro = npc.giver && questStepRef.current < 0
      setTalking(null)
      setTalkLine(0)
      if (wasGiverIntro) setQuestStep(0)
    }
  }
  advanceRef.current = advance

  // keyboard input
  useEffect(() => {
    const MOVE = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (talkingRef.current) {
        if (k === 'e' || k === ' ' || k === 'enter') {
          e.preventDefault()
          advanceRef.current()
        }
        return
      }
      if (MOVE.includes(k)) {
        keys.current.add(k)
        e.preventDefault()
      } else if (k === 'e' || k === ' ' || k === 'enter') {
        const n = nearRef.current
        if (n?.kind === 'npc') {
          keys.current.clear()
          setMoving(false)
          setTalking(n.npc)
          setTalkLine(0)
        } else if (n?.kind === 'loc') {
          const s = questStepRef.current
          if (s >= 0 && s < GOLDEN_PATH.length && GOLDEN_PATH[s].targetLoc === n.loc.to) {
            saveQuestStep(s + 1) // persist immediately (scene unmounts before the effect could run)
            setQuestStep(s + 1)
          }
          goRef.current(n.loc.to)
        }
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
      if (talkingRef.current) {
        raf = requestAnimationFrame(step)
        return
      }
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
        if (walkable(nx, ny)) p = { x: nx, y: ny }
        else if (walkable(nx, p.y)) p = { x: nx, y: p.y }
        else if (walkable(p.x, ny)) p = { x: p.x, y: ny }
        posRef.current = p
        setPos(p)
        if (vx < 0) setFacing('left')
        else if (vx > 0) setFacing('right')
      }
      setMoving(isMoving)

      let best: Near = null
      let bestD = INTERACT_R
      for (const l of LOCATIONS) {
        const d = Math.hypot(l.x + 75 - p.x, l.y + 220 - p.y)
        if (d < bestD) {
          bestD = d
          best = { kind: 'loc', loc: l }
        }
      }
      for (const npc of NPCS) {
        const d = Math.hypot(npc.x - p.x, npc.y - 70 - p.y)
        if (d < bestD) {
          bestD = d
          best = { kind: 'npc', npc }
        }
      }
      const cur = nearRef.current
      const same =
        (cur === null && best === null) ||
        (cur?.kind === 'loc' && best?.kind === 'loc' && cur.loc === best.loc) ||
        (cur?.kind === 'npc' && best?.kind === 'npc' && cur.npc === best.npc)
      if (!same) {
        nearRef.current = best
        setNear(best)
      }

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
  const targetLoc = questStep >= 0 && questStep < GOLDEN_PATH.length ? GOLDEN_PATH[questStep].targetLoc : null
  const dialogueLines = talking ? (questStep >= 0 ? talking.lines.after : talking.lines.before) : []

  return (
    <SceneRoot>
      <Abs x={0} y={0} w={STAGE_W} h={STAGE_H} className="map-viewport">
        <div className="map-world" style={{ width: STAGE_W, height: STAGE_H, transform: worldTransform }}>
          <img className="map-bg" src="/art/bg-map.png" alt="" style={{ left: MAP.x, top: MAP.y, width: MAP.w, height: MAP.h }} />

          {debug && debugUrl && (
            <img className="map-debug" src={debugUrl} alt="" style={{ left: MAP.x, top: MAP.y, width: MAP.w, height: MAP.h }} />
          )}

          {LOCATIONS.map((l) => (
            <Abs
              key={l.label}
              x={l.x}
              y={l.y}
              w={150}
              h={170}
              className={`map-loc${near?.kind === 'loc' && near.loc.label === l.label ? ' is-near' : ''}${targetLoc === l.to ? ' is-target' : ''}`}
            >
              <span className="map-loc-pin" />
              <span className="map-loc-label">{l.label}</span>
            </Abs>
          ))}

          {NPCS.map((npc) => (
            <div key={npc.id}>
              <Character x={npc.x} y={npc.y} sprite={npc.sprite} facing="right" />
              <Abs x={npc.x - 160} y={npc.y - 232} w={320} h={56} className="npc-name">
                {npc.name}
              </Abs>
              {npc.giver && questStep < 0 && (
                <Abs x={npc.x - 22} y={npc.y - 312} w={44} h={70} className="npc-bang">
                  !
                </Abs>
              )}
            </div>
          ))}

          <Character x={pos.x} y={pos.y} walking={moving} facing={facing} sprite="/art/player_acai.png" />
        </div>

        {w.overlay && <Abs x={0} y={0} w={STAGE_W} h={STAGE_H} className={`weather-overlay weather-${w.overlay}`} />}
      </Abs>

      <QuestTracker step={questStep} />

      {near && !talking && (
        <div className="map-prompt">
          <kbd>E</kbd> {near.kind === 'npc' ? `对话 · ${near.npc.name}` : `进入 · ${near.loc.label}`}
        </div>
      )}
      <div className="map-help">WASD/方向键 移动 · 走近按 E 互动{debug ? ' · [P] 调试中' : ''}</div>
      <button className="map-weather-toggle" onClick={() => go(next)}>
        天气 · {w.weather}
      </button>

      {talking && (
        <NpcDialogue
          name={talking.name}
          text={dialogueLines[talkLine] ?? ''}
          last={talkLine >= dialogueLines.length - 1}
          onAdvance={advance}
        />
      )}

      <TopStatusBar weather={w.weather} temp={w.temp} auspicious={w.auspicious} />
      <NavTabs />
      <BackButton onClick={() => go('start')} />
    </SceneRoot>
  )
}
