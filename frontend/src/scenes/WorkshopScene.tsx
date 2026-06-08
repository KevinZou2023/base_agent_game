import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import { SilkCloth } from '../three/SilkCloth'
import { useNav } from '../app/nav'
import { useGame } from '../app/GameState'
import { masterChat } from '../api/client'
import type { AgentResponse, XiangyunshaParameters } from '../api/types'
import './WorkshopScene.css'

const ROOM = 5 // room half-extent on x/z

/**
 * Where the exported Unity WebGL build lives (served from frontend/public/).
 * Drop the Unity "Build" output's index.html + Build/ + TemplateData/ here and
 * this scene swaps the placeholder R3F room for the real 3D 工坊 automatically.
 */
// 缓存绕过：浏览器会死缓存 Unity 的 index.html。每次整页加载用新版本号，
// 确保替换构建后刷新页面就能拿到最新构建清单（大文件 .data/.wasm 由
// index.html 内的 ?v= 各自控制缓存，见 public/3d-ui-new/index.html）。
const UNITY_INDEX = `${import.meta.env.BASE_URL}3d-ui-new/index.html?v=${Date.now()}`

type WorkshopParamKey =
  | 'shuliang_concentration'
  | 'dye_water_temp'
  | 'sun_hours'
  | 'wu_mud_thickness'
  | 'wu_duration_minutes'
  | 'wash_water_temp'

interface CraftParamField {
  key: WorkshopParamKey
  label: string
  unit?: string
  values: number[]
}

interface CraftParamGroup {
  id: string
  label: string
  fields: CraftParamField[]
}

const CRAFT_PARAM_GROUPS: CraftParamGroup[] = [
  {
    id: 'dye',
    label: '染缸',
    fields: [
      { key: 'dye_water_temp', label: '水温', unit: '°C', values: [10, 25, 35, 55] },
      { key: 'shuliang_concentration', label: '浓度', values: [0.2, 0.5, 0.8] },
    ],
  },
  {
    id: 'dry',
    label: '晾晒',
    fields: [{ key: 'sun_hours', label: '时间', unit: '小时', values: [1, 3, 6, 8] }],
  },
  {
    id: 'wu',
    label: '过乌',
    fields: [
      { key: 'wu_duration_minutes', label: '等待', unit: '分钟', values: [20, 60, 90, 130] },
      { key: 'wu_mud_thickness', label: '泥厚', values: [0.2, 0.5, 0.7, 0.9] },
    ],
  },
  {
    id: 'wash',
    label: '水洗',
    fields: [{ key: 'wash_water_temp', label: '水温', unit: '°C', values: [15, 25, 40] }],
  },
]

function formatParamValue(value: number, unit?: string) {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1)
  return unit ? `${text}${unit}` : text
}

// ───────────────────────── 师傅旁观点评 ─────────────────────────

/**
 * 师傅 Agent 实时点评气泡。
 *
 * 监听 Unity 工坊通过 postMessage 发来的操作事件，调 /master/chat，把师傅的
 * 口语反馈 + 风险标签浮在 3D 画面上。Unity 侧用 WorkshopBridge.cs 上报：
 *   workshop:op   { event: {type:'param_change', changes:{wu_duration_minutes:130}} }
 *   workshop:ask  { message: '师傅，过乌要多久？' }
 * 离线时 client.ts 的 masterChat 会自动回退到 mock，不依赖后端。
 */
function MasterBubble() {
  const { player, setParams } = useGame()
  const playerRef = useRef(player)
  playerRef.current = player
  const setParamsRef = useRef(setParams)
  setParamsRef.current = setParams

  const [resp, setResp] = useState<AgentResponse | null>(() => ({
    master_reply: '后生，进坊后我在旁边看着你。拿布、下缸、晒干、过乌时有不妥，我会提醒你。',
    risk_tags: [],
    hint_type: 'encourage',
    intervention_level: 1,
    recommended_actions: [],
    knowledge_used: [],
    operation_summary: '进入 3D 工坊',
    stage: player.current_stage,
    debug: { local_welcome: true },
  }))
  const [loading, setLoading] = useState(false)
  const seq = useRef(0)
  const hideTimer = useRef<number | undefined>(undefined)
  const opDebounce = useRef<number | undefined>(undefined)

  useEffect(() => {
    const ask = async (payload: { operation_event?: Record<string, unknown>; message?: string }) => {
      const id = ++seq.current
      setLoading(true)
      window.clearTimeout(hideTimer.current)
      try {
        const { data } = await masterChat({
          player_state: playerRef.current,
          message: payload.message,
          operation_event: payload.operation_event ?? null,
        })
        if (id !== seq.current) return // 已有更新的请求，丢弃这次
        setResp(data)
      } catch {
        if (id === seq.current) setResp(null)
      } finally {
        if (id === seq.current) {
          setLoading(false)
          hideTimer.current = window.setTimeout(() => setResp(null), 14000)
        }
      }
    }

    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; event?: Record<string, unknown>; message?: string } | null
      if (!d) return
      if (d.type === 'workshop:op') {
        const event = d.event
        // 「打开参数面板」消息由 ParameterPanel 处理，师傅不点评、不累计
        if (event && (event as { type?: string }).type === 'open_params') return
        // 把 3D 里的真实操作累计进玩家状态 → 师傅点评 + 最终五维评分都按真实工艺来
        if (event && event.type === 'param_change' && event.changes) {
          setParamsRef.current(event.changes as Partial<XiangyunshaParameters>)
        }
        // 把连续的参数改动合并成一次点评，避免刷爆 LLM
        window.clearTimeout(opDebounce.current)
        opDebounce.current = window.setTimeout(() => void ask({ operation_event: event }), 700)
      } else if (d.type === 'workshop:ask') {
        void ask({ message: d.message })
      }
    }
    window.addEventListener('message', onMessage)

    // DEV：不依赖 Unity 也能测师傅点评 —— 控制台调用 window.__masterOp({...}) / __masterAsk('...')
    if (import.meta.env.DEV) {
      const w = window as Window & {
        __masterOp?: (event: Record<string, unknown>) => void
        __masterAsk?: (message: string) => void
      }
      w.__masterOp = (event) => void ask({ operation_event: event })
      w.__masterAsk = (message) => void ask({ message })
    }

    return () => {
      window.removeEventListener('message', onMessage)
      window.clearTimeout(hideTimer.current)
      window.clearTimeout(opDebounce.current)
    }
  }, [])

  if (!loading && !resp) return null
  const tone = resp?.hint_type ?? 'explicit'
  return (
    <div className={`master-bubble tone-${tone}`}>
      <img className="master-bubble-face" src="/art/villager-master.png" alt="师傅" />
      <div className="master-bubble-body">
        <div className="master-bubble-name">师傅</div>
        {loading ? (
          <div className="master-bubble-text master-bubble-thinking">师傅正在看你的活计……</div>
        ) : (
          <>
            <div className="master-bubble-text">{resp!.master_reply}</div>
            {resp!.risk_tags.length > 0 && (
              <div className="master-bubble-risks">
                {resp!.risk_tags.map((t) => (
                  <span key={t} className="master-bubble-risk">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ───────────────────────── 工艺参数兜底 HUD ─────────────────────────

function CraftParamHud({ onOpen }: { onOpen: () => void }) {
  const { player } = useGame()
  const [open, setOpen] = useState(false)
  const [activeGroupId, setActiveGroupId] = useState(CRAFT_PARAM_GROUPS[0].id)
  const activeGroup = CRAFT_PARAM_GROUPS.find((g) => g.id === activeGroupId) ?? CRAFT_PARAM_GROUPS[0]

  const toggleOpen = () => {
    if (!open) onOpen()
    setOpen((v) => !v)
  }

  const applyParam = (key: WorkshopParamKey, value: number) => {
    const changes = { [key]: value } as Partial<XiangyunshaParameters>
    window.postMessage({ type: 'workshop:op', event: { type: 'param_change', changes } }, '*')
  }

  return (
    <>
      <button className="workshop-param-btn" onClick={toggleOpen}>
        工艺参数
      </button>
      {open && (
        <div className="workshop-param-panel">
          <div className="workshop-param-tabs">
            {CRAFT_PARAM_GROUPS.map((group) => (
              <button
                key={group.id}
                className={group.id === activeGroupId ? 'active' : ''}
                onClick={() => setActiveGroupId(group.id)}
              >
                {group.label}
              </button>
            ))}
          </div>
          <div className="workshop-param-fields">
            {activeGroup.fields.map((field) => {
              const current = player.parameters[field.key]
              return (
                <div className="workshop-param-field" key={field.key}>
                  <div className="workshop-param-label">{field.label}</div>
                  <div className="workshop-param-options">
                    {field.values.map((value) => {
                      const selected = Math.abs(current - value) < 0.001
                      return (
                        <button
                          key={value}
                          className={selected ? 'selected' : ''}
                          onClick={() => applyParam(field.key, value)}
                        >
                          {formatParamValue(value, field.unit)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

// ───────────────────────── 工艺参数面板（网页浮层）─────────────────────────

type ParamRow = { key: keyof XiangyunshaParameters; label: string; unit: string; options: number[] }
const PARAM_PANELS: Record<string, { title: string; rows: ParamRow[] }> = {
  DyeVat: {
    title: '染缸参数',
    rows: [
      { key: 'dye_water_temp', label: '染液水温', unit: '°C', options: [10, 25, 35, 55] },
      { key: 'shuliang_concentration', label: '薯莨浓度', unit: '', options: [0.2, 0.5, 0.8] },
    ],
  },
  Drying: {
    title: '晾晒参数',
    rows: [{ key: 'sun_hours', label: '单次日晒', unit: ' 小时', options: [1, 3, 6, 8] }],
  },
  Wu: {
    title: '过乌参数',
    rows: [
      { key: 'wu_duration_minutes', label: '过乌等待', unit: ' 分钟', options: [20, 60, 90, 130] },
      { key: 'wu_mud_thickness', label: '泥浆厚度', unit: '', options: [0.2, 0.5, 0.7, 0.9] },
    ],
  },
  Wash: {
    title: '水洗参数',
    rows: [{ key: 'wash_water_temp', label: '水洗水温', unit: '°C', options: [15, 25, 40] }],
  },
}

/**
 * 工艺参数面板：在 3D 工坊里按 R（靠近染缸/晾晒/过乌/水洗工位）时，Unity 会
 * 松开鼠标并发来 {type:'open_params', kind}，这里弹出可点的网页浮层。选完「应用」
 * 后以 param_change 上报 → 师傅点评 + 累计进玩家状态（最终五维评分用得上）。
 */
function ParameterPanel() {
  const { player } = useGame()
  const playerRef = useRef(player)
  playerRef.current = player
  const [kind, setKind] = useState<string | null>(null)
  const [sel, setSel] = useState<Record<string, number>>({})

  useEffect(() => {
    const open = (k: string) => {
      const cfg = PARAM_PANELS[k]
      if (!cfg) return
      const init: Record<string, number> = {}
      for (const row of cfg.rows) {
        const cur = Number(playerRef.current.parameters[row.key] ?? row.options[0])
        // 预选最接近当前值的选项
        init[row.key as string] = row.options.reduce(
          (a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a),
          row.options[0],
        )
      }
      setSel(init)
      setKind(k)
    }
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; event?: { type?: string; kind?: string } } | null
      if (d && d.type === 'workshop:op' && d.event && d.event.type === 'open_params' && d.event.kind) {
        open(d.event.kind)
      }
    }
    window.addEventListener('message', onMessage)
    // DEV：控制台 window.__openParams('DyeVat') 直接测
    if (import.meta.env.DEV) {
      ;(window as Window & { __openParams?: (k: string) => void }).__openParams = open
    }
    return () => window.removeEventListener('message', onMessage)
  }, [])

  if (!kind) return null
  const cfg = PARAM_PANELS[kind]
  if (!cfg) return null

  const apply = () => {
    window.postMessage({ type: 'workshop:op', event: { type: 'param_change', changes: { ...sel } } }, '*')
    setKind(null)
  }

  return (
    <div className="param-veil" onClick={() => setKind(null)}>
      <div className="param-panel" onClick={(e) => e.stopPropagation()}>
        <div className="param-title">{cfg.title}</div>
        {cfg.rows.map((row) => (
          <div className="param-row" key={row.key as string}>
            <div className="param-row-label">{row.label}</div>
            <div className="param-row-opts">
              {row.options.map((opt) => (
                <button
                  key={opt}
                  className={`param-opt${sel[row.key as string] === opt ? ' param-opt-sel' : ''}`}
                  onClick={() => setSel((s) => ({ ...s, [row.key as string]: opt }))}
                >
                  {opt}
                  {row.unit}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="param-btns">
          <button className="param-cancel" onClick={() => setKind(null)}>
            取消
          </button>
          <button className="param-apply" onClick={apply}>
            应用 · 师傅点评
          </button>
        </div>
        <div className="param-hint">选完点「应用」，回工坊点击画面继续游玩</div>
      </div>
    </div>
  )
}

// ───────────────────────── Unity WebGL host ─────────────────────────

/** Full-stage iframe that embeds the exported Unity 工坊. */
function UnityWorkshop({ onFinish, onLeave }: { onFinish: () => void; onLeave: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false) // Unity 指针锁定 = 鼠标在转视角
  const [everLocked, setEverLocked] = useState(false)
  const [dismissed, setDismissed] = useState(false) // 用户点了「继续」收起暂停面板
  const [asking, setAsking] = useState(false) // 「问师傅」输入框是否展开
  const [question, setQuestion] = useState('')

  // The Unity build can tell React it's done — wire a button in Unity to
  // `window.parent.postMessage({ type: 'workshop:finish' }, '*')` and the
  // existing 成品 (showcase3d) flow kicks in. 'workshop:leave' returns to map.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const t = (e.data && (e.data as { type?: string }).type) || ''
      if (t === 'workshop:finish') onFinish()
      else if (t === 'workshop:leave') onLeave()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onFinish, onLeave])

  // PCMovement.cs locks the pointer for mouse-look with NO key to release it,
  // so the cursor can't reach the HUD buttons. ESC always frees it (browser
  // default). We watch the (same-origin) iframe's pointer-lock state to show a
  // hint while locked, and a clickable pause panel once the mouse is freed.
  const onIframeLoad = () => {
    setLoading(false)
    try {
      const doc = iframeRef.current?.contentDocument
      if (!doc) return

      // Force the Unity canvas to fill the iframe, regardless of the build's
      // index.html (Unity's default template hardcodes 960×600). Injecting it
      // here means a future re-export can just drop in the RAW build folder —
      // no need to re-edit index.html. !important beats Unity's inline width.
      const style = doc.createElement('style')
      style.textContent =
        'html,body{margin:0;height:100%;background:#1a1109;overflow:hidden}' +
        '#unity-container,#unity-container.unity-desktop{position:absolute;inset:0;left:0;top:0;width:100%;height:100%;transform:none}' +
        '#unity-canvas{width:100%!important;height:100%!important;display:block;background:#1a1109}' +
        '#unity-footer{display:none}'
      doc.head?.appendChild(style)

      const sync = () => {
        const isLocked = !!doc.pointerLockElement
        setLocked(isLocked)
        if (isLocked) {
          setEverLocked(true)
          setDismissed(false) // 重新进入视角 → 下次松鼠标仍弹暂停面板
        }
      }
      doc.addEventListener('pointerlockchange', sync)
      sync()
    } catch {
      /* cross-origin (shouldn't happen, same host) — corner HUD + hint still work */
    }
  }

  // Belt-and-suspenders: also free the mouse programmatically on ESC.
  const releaseMouse = () => {
    try {
      iframeRef.current?.contentDocument?.exitPointerLock?.()
    } catch {
      /* ignore */
    }
  }

  // 「问师傅」：把问题作为 workshop:ask 发给 MasterBubble（复用同一条点评管线）
  const openAsk = () => {
    releaseMouse() // 先松开鼠标，才能在输入框里打字
    setAsking(true)
  }
  const submitQuestion = () => {
    const q = question.trim()
    if (!q) return
    window.postMessage({ type: 'workshop:ask', message: q }, '*')
    setQuestion('')
    setAsking(false)
  }

  return (
    <>
      <iframe
        ref={iframeRef}
        className="workshop-unity"
        src={UNITY_INDEX}
        title="香云纱 3D 工坊"
        allow="fullscreen; autoplay; xr-spatial-tracking; pointer-lock"
        onLoad={onIframeLoad}
      />

      {loading && (
        <div className="workshop-enter">
          <div className="workshop-enter-title">染 坊</div>
          <div className="workshop-enter-sub">3D 工坊加载中……首次进入需下载资源，请稍候</div>
        </div>
      )}

      {/* 锁定时：提示如何松开鼠标 */}
      {!loading && locked && (
        <div className="workshop-locktip">🖱 鼠标用于转视角中 · 按 ESC 松开鼠标，即可点击下方按钮</div>
      )}

      {/* 松开后（曾锁定过）：弹出可点击的暂停面板 */}
      {!loading && everLocked && !locked && !dismissed && (
        <div className="workshop-pause">
          <div className="workshop-pause-card">
            <div className="workshop-pause-title">已 暂 停</div>
            <div className="workshop-pause-sub">鼠标已松开。点「继续」回到工坊（再点画面恢复转视角），或选择离开。</div>
            <div className="workshop-pause-btns">
              <button className="workshop-pause-resume" onClick={() => setDismissed(true)}>
                继续游玩
              </button>
              <button className="workshop-pause-leave" onClick={onLeave}>
                离开工坊 · 回地图
              </button>
              <button className="workshop-pause-finish" onClick={onFinish}>
                确认完成 · 看五维评分
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 始终可用的兜底退出：右上角小按钮，先松鼠标再回地图 */}
      {!loading && (
        <button
          className="workshop-escape"
          onClick={() => {
            releaseMouse()
            onLeave()
          }}
          title="松开鼠标并返回地图"
        >
          ✕ 退出
        </button>
      )}

      {/* 问师傅：主动提问 */}
      {!loading && !asking && (
        <button className="workshop-ask-btn" onClick={openAsk} title="向师傅提问">
          ✎ 问师傅
        </button>
      )}
      {!loading && asking && (
        <div className="workshop-ask-panel">
          <input
            className="workshop-ask-input"
            autoFocus
            placeholder="想问师傅什么？例如：过乌要刷几遍？"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitQuestion()
              if (e.key === 'Escape') {
                setAsking(false)
                setQuestion('')
              }
            }}
          />
          <button className="workshop-ask-send" onClick={submitQuestion}>
            问
          </button>
          <button
            className="workshop-ask-cancel"
            onClick={() => {
              setAsking(false)
              setQuestion('')
            }}
          >
            ✕
          </button>
        </div>
      )}

      {!loading && <CraftParamHud onOpen={releaseMouse} />}

      {/* 师傅旁观点评（监听 Unity 上报的操作事件） */}
      {!loading && <MasterBubble />}

      {/* 工艺参数面板（按 R 触发，网页浮层，可点） */}
      {!loading && <ParameterPanel />}
    </>
  )
}

// ──────────────────── R3F placeholder (fallback) ────────────────────

/** WASD walk for the first-person camera, clamped inside the room. */
function FirstPersonMovement() {
  const { camera } = useThree()
  const keys = useRef<Set<string>>(new Set())
  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase())
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])
  useFrame((_, dt) => {
    const k = keys.current
    const fwd = new THREE.Vector3()
    camera.getWorldDirection(fwd)
    fwd.y = 0
    fwd.normalize()
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize()
    const move = new THREE.Vector3()
    if (k.has('w') || k.has('arrowup')) move.add(fwd)
    if (k.has('s') || k.has('arrowdown')) move.sub(fwd)
    if (k.has('d') || k.has('arrowright')) move.add(right)
    if (k.has('a') || k.has('arrowleft')) move.sub(right)
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(2.6 * Math.min(dt, 0.05))
      camera.position.add(move)
    }
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ROOM + 0.6, ROOM - 0.6)
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ROOM + 0.6, ROOM - 0.6)
    camera.position.y = 1.6
  })
  return null
}

function Room() {
  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM * 2, ROOM * 2]} />
        <meshStandardMaterial color="#6e5536" roughness={0.95} />
      </mesh>
      {/* ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 4, 0]}>
        <planeGeometry args={[ROOM * 2, ROOM * 2]} />
        <meshStandardMaterial color="#2e2418" roughness={1} />
      </mesh>
      {/* walls */}
      {(
        [
          [0, 2, -ROOM, 0],
          [0, 2, ROOM, Math.PI],
          [-ROOM, 2, 0, Math.PI / 2],
          [ROOM, 2, 0, -Math.PI / 2],
        ] as [number, number, number, number][]
      ).map(([x, y, z, ry], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, ry, 0]} receiveShadow>
          <planeGeometry args={[ROOM * 2, 4]} />
          <meshStandardMaterial color="#d8c8a8" roughness={0.96} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* ceiling beams */}
      {[-2.4, 0, 2.4].map((x) => (
        <mesh key={x} position={[x, 3.7, 0]} castShadow>
          <boxGeometry args={[0.22, 0.3, ROOM * 2]} />
          <meshStandardMaterial color="#46331f" roughness={0.9} />
        </mesh>
      ))}
      {/* a bright "window" on the back wall — reads as daylight pouring in */}
      <mesh position={[2.6, 2.1, -ROOM + 0.02]}>
        <planeGeometry args={[1.8, 2.2]} />
        <meshStandardMaterial color="#fff2d6" emissive="#ffe7b8" emissiveIntensity={1.6} />
      </mesh>
    </group>
  )
}

function DyeVat() {
  return (
    <group position={[0, 0, -1.8]}>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.72, 0.62, 0.84, 28]} />
        <meshStandardMaterial color="#2e2114" roughness={0.7} />
      </mesh>
      {/* dye surface */}
      <mesh position={[0, 0.82, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.64, 28]} />
        <meshStandardMaterial color="#4a2614" roughness={0.22} metalness={0.2} emissive="#2a130a" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

function ClothRack() {
  return (
    <group position={[2.4, 0, 1.2]} rotation={[0, -0.7, 0]}>
      {/* two posts + a top bar */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.1, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 2.8, 12]} />
          <meshStandardMaterial color="#4a3622" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 2.7, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 2.4, 12]} />
        <meshStandardMaterial color="#4a3622" roughness={0.9} />
      </mesh>
      {/* the hanging silk */}
      <group position={[0, 1.0, 0]} scale={0.42}>
        <SilkCloth textureUrl="/art/cloth-brown.png" />
      </group>
    </group>
  )
}

/** The original procedural R3F 染坊 — shown until the Unity build is dropped in. */
function R3FWorkshop() {
  const [locked, setLocked] = useState(false)

  // R3F's canvas can latch a stale size inside the transform-scaled <Stage>; nudge it.
  useEffect(() => {
    const fire = () => window.dispatchEvent(new Event('resize'))
    const r = requestAnimationFrame(fire)
    const t = window.setTimeout(fire, 120)
    return () => {
      cancelAnimationFrame(r)
      window.clearTimeout(t)
    }
  }, [])

  return (
    <>
      <Canvas
        className="workshop-canvas"
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        camera={{ position: [0, 1.6, 2.6], fov: 72 }}
      >
        <color attach="background" args={['#1a1109']} />
        <fog attach="fog" args={['#1a1109', 7, 18]} />

        <ambientLight intensity={0.3} />
        <directionalLight position={[3, 5, -2]} intensity={2.2} color="#ffe6c0" castShadow shadow-mapSize={[1024, 1024]} />
        <pointLight position={[0, 3.4, 0]} intensity={14} color="#ffcf8a" />
        <pointLight position={[2.5, 2, -4]} intensity={20} color="#fff0d0" />

        <Suspense fallback={null}>
          <Room />
          <DyeVat />
          <ClothRack />
        </Suspense>

        <PointerLockControls onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />
        <FirstPersonMovement />

        <EffectComposer>
          <Bloom intensity={0.45} luminanceThreshold={0.6} luminanceSmoothing={0.3} mipmapBlur />
          <Vignette eskil={false} offset={0.3} darkness={0.82} />
          <Noise opacity={0.03} premultiply />
        </EffectComposer>
      </Canvas>

      {!locked && (
        <div className="workshop-enter">
          <div className="workshop-enter-title">染 坊</div>
          <div className="workshop-enter-sub">点击进入第一人称 · WASD 走动 · 鼠标环顾 · ESC 退出</div>
        </div>
      )}
    </>
  )
}

// ───────────────────────────── Scene ─────────────────────────────

type Probe = 'checking' | 'unity' | 'fallback'

export function WorkshopScene() {
  const { go } = useNav()
  const { finishCraft } = useGame()
  const [probe, setProbe] = useState<Probe>('checking')

  // Decide which workshop to show: the exported Unity build if present,
  // otherwise the procedural R3F room. We can't trust the HTTP status — Vite's
  // dev server (and most static SPA hosts) serve the app's own index.html with
  // a 200 for any missing path. So fetch the body and look for Unity's loader
  // signature; only a real Unity build's index.html contains createUnityInstance.
  useEffect(() => {
    let alive = true
    fetch(UNITY_INDEX)
      .then((r) => (r.ok ? r.text() : ''))
      .then((html) => {
        if (alive) setProbe(/createUnityInstance|UnityLoader/.test(html) ? 'unity' : 'fallback')
      })
      .catch(() => {
        if (alive) setProbe('fallback')
      })
    return () => {
      alive = false
    }
  }, [])

  const finish = () => {
    void finishCraft()
    go('showcase3d')
  }

  return (
    <div className="workshop-root">
      {probe === 'checking' && (
        <div className="workshop-enter">
          <div className="workshop-enter-title">染 坊</div>
          <div className="workshop-enter-sub">正在进入工坊……</div>
        </div>
      )}

      {probe === 'unity' && <UnityWorkshop onFinish={finish} onLeave={() => go('map')} />}

      {probe === 'fallback' && <R3FWorkshop />}

      {probe !== 'checking' && (
        <div className="workshop-hud">
          <button className="workshop-back" onClick={() => go('map')}>
            ‹ 离开工坊
          </button>
          <button className="workshop-finish" onClick={finish}>
            确认完成 · 看五维评分 ›
          </button>
        </div>
      )}
    </div>
  )
}
