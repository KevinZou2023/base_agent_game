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
import { masterChat } from '../api/client'
import { STAGE_W, STAGE_H } from '../theme/tokens'
import './MapScene.css'

// ── movement tunables — speeds are px/SECOND (frame-rate independent) ──
const ZOOM = 2.0
const MAX_SPEED = 270 // top walking speed (logical px/s); lower = calmer
const ACCEL = 2600 // ramp-up (px/s²); lower = floatier start
const DECEL = 3400 // ramp-down (px/s²); higher = snappier stop
const STEP_LEN = 80 // logical px per step-bounce — tunes walk cadence
const BOB_AMP = 8 // peak step-bounce height (px)
const CAM_RATE = 9 // camera follow stiffness (1/s); higher = tighter
const INTERACT_R = 400

const MAP = { x: 64, y: 64, w: STAGE_W - 128, h: STAGE_H - 128 }
const START = { x: 1500, y: 1320 }

// 记住玩家在地图上的位置：离开/返回（含进地点、切天气）后回到原地，而非每次重置到 START。
const MAP_POS_KEY = 'liangzuo.map_pos'
type Pos = { x: number; y: number }
function loadMapPos(): Pos {
  try {
    const raw = localStorage.getItem(MAP_POS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Pos
      if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) return p
    }
  } catch {
    /* ignore corrupt */
  }
  return START
}
const saveMapPos = (p: Pos) => {
  try {
    localStorage.setItem(MAP_POS_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

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

// 地图 NPC 对话 — 根据任务进度动态生成，更口语化、生活化
function buildMapNpcLines(step: number, completedSteps: Set<number>, npcId: string): string[] {
  const done = completedSteps.has(step)

  if (step === -1) {
    if (npcId === 'granny') return [
      '哎呦，后生仔来啦，是想学香云纱吧？',
      '那你得先去拜师，师父就住在村子里头那座大屋，去找他便是。',
    ]
    if (npcId === 'yeye') return [
      '后生仔，这河边的风啊，带着薯莨的香气呢。',
      '要学这门手艺，先去拜个师父吧，村子里找找看。',
    ]
    return ['先去找师父学学基本功吧，他就在村子里。', '师父会告诉你香云纱制作的每一步。']
  }

  if (step === 0 && !done) {
    if (npcId === 'granny') return [
      '还没去拜师吧？师父在「师父的家」，村子里找找看。',
      '拜了师才能正式学艺，别着急，慢慢来。',
    ]
    if (npcId === 'yeye') return [
      '先去拜师吧，师父那边才是正经学手艺的地方。',
      '这香云纱啊，得师父领进门才行。',
    ]
    return ['先去拜师吧，师父在「师父的家」。', '拜师之后就可以一步一步学了。']
  }

  if (done) {
    const next = GOLDEN_PATH[step]
    if (!next) {
      if (npcId === 'granny') return [
        '哎呀，你这后生仔真出息，六道工序全学完啦！',
        '师父要是知道，肯定高兴。好好做，将来这手艺就靠你们传下去咯。',
      ]
      if (npcId === 'yeye') return [
        '嗯，学成了啊。香云纱这手艺，你算是入了门了。',
        '好好做，将来也教教别的小子。',
      ]
      return ['你真厉害！香云纱的六道工序都学完了！', '继续努力，把这门手艺发扬光大！']
    }
    const locName: Record<string, string> = {
      master: '师父的家', mountain: '青翠山', dye: '染坊',
      drying: '晾晒场', river: '乌尔河', weaving: '织布坊',
    }
    const tips: Record<string, string> = {
      mountain: '青翠山上有野生的薯莨，采一些来做莨水最合适。',
      dye: '染坊里头浸染布料，这步可不能马虎。',
      drying: '晾晒场晒莨布，大太阳天最好，晒出来的布才亮。',
      river: '乌尔河的泥最适宜过乌，去那边找找看。',
      weaving: '织布坊里可以做成品了，成品好不好就看你前面功夫深不深。',
    }
    if (npcId === 'granny') return [
      `好，下一步该学「${next.objective}」咯。`,
      `${tips[next.targetLoc] ?? '去吧，路上小心些。'}去「${locName[next.targetLoc]}」找相应的材料或者工具便是。`,
    ]
    if (npcId === 'yeye') return [
      `下一步啊，是「${next.objective}」。`,
      `${tips[next.targetLoc] ?? '别愣着了，快去吧。'}去「${locName[next.targetLoc]}」便是。`,
    ]
    return [`下一步是「${next.objective}」。`, `去「${locName[next.targetLoc] ?? next.targetLoc}」继续吧。`]
  }

  const current = GOLDEN_PATH[step]
  const locName: Record<string, string> = {
    master: '师父的家', mountain: '青翠山', dye: '染坊',
    drying: '晾晒场', river: '乌尔河', weaving: '织布坊',
  }
  const curTips: Record<string, string> = {
    mountain: '青翠山上采薯莨，晴天去最好，雨天采的偏湿。',
    dye: '染坊浸染，看准火候，不要急。',
    drying: '晾晒场晒莨布，日头最要紧，晒不够或者晒过头都不行。',
    river: '过乌去乌尔河，晴天去最好，雨天河泥会变稀。',
    weaving: '织布坊里织布成衣，前面的功夫都在这里见分晓。',
  }
  if (npcId === 'granny') return [
    `你现在该学「${current.objective}」咯。`,
    `${curTips[current.targetLoc] ?? '去试试吧。'}去「${locName[current.targetLoc]}」看看。完成了再来跟我说。`,
  ]
  if (npcId === 'yeye') return [
    `这一步啊，是「${current.objective}」。`,
    `${curTips[current.targetLoc] ?? '去吧。'}去「${locName[current.targetLoc]}」做好了再来。`,
  ]
  return [`你现在应该在学「${current.objective}」。`, `去「${locName[current.targetLoc] ?? current.targetLoc}」看看吧。`]
}

// ── walkable geometry (logical coords) — user-defined, calibrate with P overlay ──
// Generous central courtyard, MINUS the pond & building footprints. Only the big
// obstacles are blocked, so movement stays smooth (never pinched on trees/specks).
const GRID_W = 252
const GRID_H = 140
const BOUND: [number, number][] = [
  [200, 440], // 左上扩展：原来660 → 200（让玩家能走到村庄左侧）
  [2740, 430],
  [3030, 720],
  [3030, 1310],
  [2500, 1585],
  [1230, 1620],
  [200, 900],    // 左下扩展：原来580 → 200（让玩家能走到青翠山方向）
]
const POND = { cx: 1650, cy: 1035, rx: 315, ry: 150 }

// 小型装饰障碍（树木、篱笆、石头等视觉上应阻挡的区域）
// 按 P 键开启 debug overlay 逐个验证后再添加
const DECOR_OBSTACLES: [number, number, number, number][] = [
  // 示例：[x0, y0, x1, y1]
  // 在 debug overlay 开启状态下，踩绿色（walkable）但视觉上不应该通过的区域
]
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
  for (const [x0, y0, x1, y1] of DECOR_OBSTACLES) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return false
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
  const { player, setWeather, resetProgress, completedSteps, gameTime } = useGame()
  const w = WEATHER[scene] ?? WEATHER.map
  const next = ORDER[(Math.max(0, ORDER.indexOf(scene)) + 1) % ORDER.length]
  const [musicOn, setMusicOn] = useState(() => {
    try { return localStorage.getItem('liangzuo.music_on') !== 'off' } catch { return true }
  })

  // 监听音乐切换事件，同步图标状态
  useEffect(() => {
    const handler = () => {
      try { setMusicOn(localStorage.getItem('liangzuo.music_on') !== 'off') } catch {}
    }
    window.addEventListener('liangzuo.toggle-music', handler)
    return () => window.removeEventListener('liangzuo.toggle-music', handler)
  }, [])

  useEffect(() => {
    setWeather(scene === 'mapRainy' ? 'rainy' : scene === 'mapCloudy' ? 'cloudy' : 'sunny')
  }, [scene, setWeather])

  const [start] = useState(loadMapPos) // 进入时还原上次位置（懒加载一次）
  const [pos, setPos] = useState(start)
  const [cam, setCam] = useState(start)
  const [facing, setFacing] = useState<'left' | 'right'>('right')
  const [moving, setMoving] = useState(false)
  const [bob, setBob] = useState(0)
  const [near, setNear] = useState<Near>(null)
  const [debug, setDebug] = useState(false)
  const [questStep, setQuestStep] = useState<number>(() => loadQuestStep())
  const [talking, setTalking] = useState<Npc | null>(null)
  const [talkLine, setTalkLine] = useState(0)
  const [aiLines, setAiLines] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)

  const posRef = useRef(start)
  const camRef = useRef(start)
  const keys = useRef<Set<string>>(new Set())
  const nearRef = useRef<Near>(null)
  const goRef = useRef(go)
  const questStepRef = useRef(questStep)
  const completedStepsRef = useRef(completedSteps)
  const talkingRef = useRef<Npc | null>(null)
  const talkLineRef = useRef(0)
  const advanceRef = useRef<() => void>(() => {})
  const aiLinesRef = useRef<string[]>([])
  const aiLoadingRef = useRef(false)
  const velRef = useRef({ x: 0, y: 0 })
  const distRef = useRef(0)
  const lastTsRef = useRef(0)
  goRef.current = go
  questStepRef.current = questStep
  completedStepsRef.current = completedSteps
  talkingRef.current = talking
  talkLineRef.current = talkLine
  aiLinesRef.current = aiLines
  aiLoadingRef.current = aiLoading

  useEffect(() => saveQuestStep(questStep), [questStep])

  // 离开地图（进地点 / 切天气 / 卸载）时记住当前位置
  useEffect(() => () => saveMapPos(posRef.current), [])

  // debug overlay (press P) — built once from the explicit walkable geometry
  const debugUrl = useMemo(() => buildDebugOverlay(), [])

  // advance / close NPC dialogue
  const advance = () => {
    const npc = talkingRef.current
    if (!npc) return
    const ai = aiLinesRef.current
    const npcLines = buildMapNpcLines(questStepRef.current, completedStepsRef.current, npc.id)
    const lines = ai.length > 0 ? ai : npcLines
    if (talkLineRef.current < lines.length - 1) {
      setTalkLine((l) => l + 1)
    } else {
      const wasGiverIntro = npc.giver && questStepRef.current < 0
      setTalking(null)
      setTalkLine(0)
      setAiLines([])
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
          if (n.npc.id === 'master') {
            // 师父：调用 AI 聊天
            setAiLoading(true)
            setAiLines([])
            masterChat({ player_state: player, message: null, npc_id: n.npc.id || undefined })
              .then(({ data }) => {
                const reply = data && data.master_reply || ""; const sentences = reply
                  .split(/(?:[。！？]+)/)
                  .map((s: string) => s.trim())
                  .filter(Boolean)
                const npcLines = buildMapNpcLines(questStepRef.current, completedStepsRef.current, 'master')
                setAiLines(sentences.length ? sentences : npcLines)
                setTalkLine(0)
              })
              .catch(() => {
                setAiLines(buildMapNpcLines(questStepRef.current, completedStepsRef.current, 'master'))
                setTalkLine(0)
              })
              .finally(() => setAiLoading(false))
          } else {
            // 阿婆/老爷爷：直接用任务进度对话，不用 AI
            setAiLoading(false)
            setAiLines([])
          }
        } else if (n?.kind === 'loc') {
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

  // movement + camera game loop — dt-based, accel/decel, distance-locked step bob
  useEffect(() => {
    const halfW = STAGE_W / 2 / ZOOM
    const halfH = STAGE_H / 2 / ZOOM
    const approach = (v: number, target: number, maxDelta: number) => {
      const d = target - v
      if (d > maxDelta) return v + maxDelta
      if (d < -maxDelta) return v - maxDelta
      return target
    }
    lastTsRef.current = 0
    velRef.current = { x: 0, y: 0 }
    distRef.current = 0
    let raf = 0
    const step = (ts: number) => {
      const last = lastTsRef.current
      let dt = last ? (ts - last) / 1000 : 0
      lastTsRef.current = ts
      if (dt > 0.05) dt = 0.05 // clamp tab-switch / dialogue gaps so we never teleport

      // paused during NPC dialogue: bleed off velocity, keep the loop alive
      if (talkingRef.current) {
        velRef.current = { x: 0, y: 0 }
        setMoving(false)
        raf = requestAnimationFrame(step)
        return
      }

      const k = keys.current
      let ix = 0
      let iy = 0
      if (k.has('w') || k.has('arrowup')) iy -= 1
      if (k.has('s') || k.has('arrowdown')) iy += 1
      if (k.has('a') || k.has('arrowleft')) ix -= 1
      if (k.has('d') || k.has('arrowright')) ix += 1
      const hasInput = ix !== 0 || iy !== 0

      // target velocity, normalized so diagonals aren't faster
      let tvx = 0
      let tvy = 0
      if (hasInput) {
        const len = Math.hypot(ix, iy)
        tvx = (ix / len) * MAX_SPEED
        tvy = (iy / len) * MAX_SPEED
      }
      const maxDelta = (hasInput ? ACCEL : DECEL) * dt
      const vel = velRef.current
      vel.x = approach(vel.x, tvx, maxDelta)
      vel.y = approach(vel.y, tvy, maxDelta)

      const speed = Math.hypot(vel.x, vel.y)
      let p = posRef.current
      if (speed > 0) {
        const nx = p.x + vel.x * dt
        const ny = p.y + vel.y * dt
        if (walkable(nx, ny)) p = { x: nx, y: ny }
        else if (walkable(nx, p.y)) { p = { x: nx, y: p.y }; vel.y = 0 } // slide along walls
        else if (walkable(p.x, ny)) { p = { x: p.x, y: ny }; vel.x = 0 }
        else { vel.x = 0; vel.y = 0 }
        posRef.current = p
        setPos(p)
        if (vel.x < -6) setFacing('left')
        else if (vel.x > 6) setFacing('right')
      }
      const moving = speed > 8
      setMoving(moving)

      // step bounce locked to distance travelled → cadence tracks ground speed
      if (moving) {
        distRef.current += speed * dt
        const amp = BOB_AMP * Math.min(1, speed / MAX_SPEED)
        const phase = (distRef.current / STEP_LEN) * Math.PI * 2
        setBob(((1 - Math.cos(phase)) / 2) * amp)
      } else {
        distRef.current = 0
        setBob((b) => (b > 0.1 ? b * 0.5 : 0))
      }

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

      // camera: dt-based exponential follow (frame-rate independent)
      const c = camRef.current
      const tx = clamp(p.x, MAP.x + halfW, MAP.x + MAP.w - halfW)
      const ty = clamp(p.y, MAP.y + halfH, MAP.y + MAP.h - halfH)
      const a = 1 - Math.exp(-CAM_RATE * dt)
      const nc = { x: c.x + (tx - c.x) * a, y: c.y + (ty - c.y) * a }
      camRef.current = nc
      setCam(nc)

      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  const worldTransform = `translate(${STAGE_W / 2 - cam.x * ZOOM}px, ${STAGE_H / 2 - cam.y * ZOOM}px) scale(${ZOOM})`
  const targetLoc = questStep >= 0 && questStep < GOLDEN_PATH.length ? GOLDEN_PATH[questStep].targetLoc : null
  const dialogueLines = aiLines.length > 0
    ? aiLines
    : (talking ? buildMapNpcLines(questStep, completedSteps, talking.id) : [])

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

          <Character x={pos.x} y={pos.y} walking={moving} facing={facing} bobY={bob} sprite="/art/player_acai.png" />
        </div>

        {w.overlay && (
          <Abs x={0} y={0} w={STAGE_W} h={STAGE_H} className={`weather-overlay weather-${w.overlay}`}>
            {w.overlay === 'rainy' && <><div className="rain-layer-3" /><div className="rain-layer-4" /><div className="rain-splash" /></>}
          </Abs>
        )}
      </Abs>

      {/* DirectionArrow: 仅在目标不可见时显示在屏幕边缘的小箭头 */}
      {targetLoc && (() => {
        const loc = LOCATIONS.find(l => l.to === targetLoc)
        if (!loc) return null
        const tx = loc.x + 75
        const ty = loc.y + 220
        // Target screen position (player always at screen center)
        const tsx = STAGE_W / 2 + (tx - cam.x) * ZOOM
        const tsy = STAGE_H / 2 + (ty - cam.y) * ZOOM
        const dx = tsx - STAGE_W / 2
        const dy = tsy - STAGE_H / 2
        const dist = Math.hypot(dx, dy)
        const angle = Math.atan2(dy, dx)
        const rotation = (angle * 180) / Math.PI + 90

        // Only show arrow when target is off-screen
        const margin = 80
        const onScreen = tsx >= margin && tsx <= STAGE_W - margin && tsy >= margin && tsy <= STAGE_H - margin
        if (onScreen) return null

        const opacity = dist < 200 ? Math.max(0, (dist - 50) / 150) : 1
        const edgeMargin = 60
        const maxOffset = Math.min(
          (STAGE_W / 2 - edgeMargin) / Math.abs(Math.cos(angle) || 1),
          (STAGE_H / 2 - edgeMargin) / Math.abs(Math.sin(angle) || 1)
        )
        const arrowDist = maxOffset * 0.90
        const ax = STAGE_W / 2 + Math.cos(angle) * arrowDist - 25
        const ay = STAGE_H / 2 + Math.sin(angle) * arrowDist - 25
        return (
          <Abs x={ax} y={ay} w={90} h={90} style={{ opacity }}>
            <div style={{
              width: 0, height: 0,
              borderLeft: '20px solid transparent',
              borderRight: '20px solid transparent',
              borderBottom: '38px solid #c89a6a',
              filter: 'drop-shadow(0 0 10px rgba(200,154,106,0.8)) drop-shadow(0 3px 6px rgba(0,0,0,0.55))',
              transform: `rotate(${rotation}deg)`,
            }} />
          </Abs>
        )
      })()}

      <QuestTracker step={questStep} onReset={resetProgress} completedSteps={completedSteps} />

      {near && !talking && (
        <div className="map-prompt">
          <kbd>E</kbd> {near.kind === 'npc' ? `对话 · ${near.npc.name}` : `进入 · ${near.loc.label}`}
        </div>
      )}
      <div className="map-help">WASD/方向键 移动 · 走近按 E 互动{debug ? ' · [P] 调试中' : ''}</div>
      <button className="map-weather-toggle" onClick={() => go(next)}>
        天气 · {w.weather}
      </button>

      {/* 音乐开关按钮 */}
      <button
        className="map-music-toggle"
        onClick={() => window.dispatchEvent(new Event('liangzuo.toggle-music'))}
        title="音乐开关"
      >
        {musicOn ? '🔊' : '🔇'}
      </button>

      {talking && (
        <NpcDialogue
          name={talking.name}
          text={dialogueLines[talkLine] ?? ''}
          last={talkLine >= dialogueLines.length - 1}
          onAdvance={advance}
          loading={aiLoading}
        />
      )}

      <TopStatusBar gameTime={gameTime} weather={w.weather} temp={w.temp} auspicious={w.auspicious} />
      <NavTabs />
      <BackButton onClick={() => go('start')} />
    </SceneRoot>
  )
}
