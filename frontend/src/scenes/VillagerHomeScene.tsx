import { useState } from 'react'
import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { SceneChrome } from '../components/SceneChrome'
import { useNav, type SceneId } from '../app/nav'
import { useGame } from '../app/GameState'
import { GOLDEN_PATH } from '../app/quest'
import './VillagerHomeScene.css'

// 根据当前任务进度生成动态对话
function buildTalkLines(questStep: number, completedSteps: Set<number>, name: string): string[] {
  const step = questStep
  const done = completedSteps.has(step)

  if (step === -1 || step === 0) {
    if (step === -1) {
      return [
        `${name}：你可以先去找师父学学基本功，他就在地图左上方的院子里。`,
        '师父会告诉你香云纱制作的每一步，跟着他学就是了。',
      ]
    }
    return [
      `${name}：先去拜师吧，师父在「师父的家」，地图左上角。`,
      '拜师之后，就可以开始学习制作香云纱的每一步工序了。',
    ]
  }

  if (done) {
    const next = GOLDEN_PATH[step]
    if (!next) {
      return [
        `${name}：你真厉害！香云纱的六道工序都学完了！`,
        '这下你已经是半个师傅啦，继续努力，把这门手艺发扬光大！',
      ]
    }
    const locName: Record<string, string> = {
      master: '师父的家', mountain: '青翠山', dye: '染坊',
      drying: '晾晒场', river: '乌尔河', weaving: '织布坊',
    }
    return [
      `${name}：干得好！下一步是「${next.objective}」。`,
      `去「${locName[next.targetLoc] ?? next.targetLoc}」继续吧，那里有你需要的东西。`,
    ]
  }

  const current = GOLDEN_PATH[step]
  const locName: Record<string, string> = {
    master: '师父的家', mountain: '青翠山', dye: '染坊',
    drying: '晾晒场', river: '乌尔河', weaving: '织布坊',
  }
  return [
    `${name}：你现在应该在学「${current.objective}」。`,
    `去「${locName[current.targetLoc] ?? current.targetLoc}」看看吧，完成之后再来说。`,
  ]
}

// 村民的家 — Figma nodes 28:1284 (阿花) / 28:1803 (阿才) / 28:2030 (老太太).
const VILLAGERS: Record<
  string,
  { name: string; portrait: string; px: number; affinity: number; giftHint: string; staticLines?: string[]; isMaster?: boolean }
> = {
  ahua: { name: '阿花', portrait: '/art/villager-ahua.png', px: 1179, affinity: 21, giftHint: '提示：年轻的女孩子总喜欢一些美而香的花朵' },
  acai: { name: '阿才', portrait: '/art/villager-acai.png', px: 1031, affinity: -2, giftHint: '提示：他似乎对什么都提不起兴趣' },
  popo: {
    name: '阿婆', portrait: '/art/villager-popo.png', px: 1144, affinity: 71,
    giftHint: '提示：阿婆爱花，尤喜清香的花朵',
    staticLines: [
      '后生仔，学香云纱是门好手艺，三分料七分晒，急不得。',
      '记住：薯莨反复浸染、河泥过乌、烈日暴晒，缺一不可。',
      '好好学，这门老手艺就靠你们后生传下去咯。',
    ],
  },
  master: {
    name: '师父', portrait: '/art/villager-master.png', px: 1080, affinity: 100,
    giftHint: '提示：师父常年与草木为伴，或许会喜欢一束清香',
    isMaster: true,
  },
}

type ActKind = 'talk' | 'invite' | 'gift' | 'intel'
const ACTIONS: { label: string; cx: number; cy: number; kind: ActKind }[] = [
  { label: '对话', cx: 2159, cy: 502, kind: 'talk' },
  { label: '邀请', cx: 2565, cy: 502, kind: 'invite' },
  { label: '送礼', cx: 2159, cy: 912, kind: 'gift' },
  { label: '情报', cx: 2565, cy: 912, kind: 'intel' },
]

// 送礼候选：美而香的花朵=鸡蛋花（对）；夹竹桃有毒、穗子是她自己的（错）
const GIFTS = [
  { name: '鸡蛋花', ok: true },
  { name: '夹竹桃', ok: false },
  { name: '阿花的穗子', ok: false },
]
// 邀请活动 → 跳到对应玩法
const INVITES: { label: string; to: SceneId }[] = [
  { label: '染布', to: 'dye' },
  { label: '晒布', to: 'drying' },
  { label: '制作装饰', to: 'space' },
]
const INTEL = '制作一块上等香云纱需要天时地利人和三重结合，晾晒时间、浸染次数、天气都有影响。'

export function VillagerHomeScene() {
  const { scene, go } = useNav()
  const { questStep, completedSteps } = useGame()
  const v = VILLAGERS[scene] ?? VILLAGERS.ahua
  const [modal, setModal] = useState<ActKind | null>(null)
  const [giftMsg, setGiftMsg] = useState<string | null>(null)
  const [talkIdx, setTalkIdx] = useState(0)

  // 阿花、师父、阿婆：对话受任务进度影响（师父先给指引再进 AI 聊天）
  const talkLines = buildTalkLines(questStep, completedSteps, v.name)

  // 好感为负 → 对方拒绝见你（Figma 村庄-对方拒绝见你 100:8500）
  if (v.affinity < 0) {
    return (
      <SceneRoot bg="/art/bg-village.png">
        <Abs x={0} y={0} w={3148} h={1773} className="vh-refused-veil" />
        <Abs x={774} y={556} w={1600} h={700} className="vh-refused">
          <span className="vh-refused-title">{v.name}的家 · 闭门</span>
          <span className="vh-refused-text">
            你没有在{v.name}家里见到人，但临走时你好像听到了房间里传来说话的声音……
          </span>
          <span className="vh-refused-sub">好感 {v.affinity} · 对方避而不见</span>
        </Abs>
        <SceneChrome back="village" />
      </SceneRoot>
    )
  }

  const openModal = (k: ActKind) => {
    if (k === 'talk') {
      if (v.isMaster) {
        // 师父：先展示任务指引，最后一句进 AI 聊天页
        if (talkLines && talkLines.length > 0) {
          setTalkIdx(0)
          setModal('talk')
        } else {
          go('masterChat')
        }
      } else if (talkLines && talkLines.length) {
        setTalkIdx(0)
        setModal('talk')
      } else {
        go('event')
      }
      return
    }
    setGiftMsg(null)
    setModal(k)
  }
  const close = () => setModal(null)

  return (
    <SceneRoot bg="/art/master-bg.png">
      {/* 竖版立绘：水平居中(w 不变)。村民=全身站房间；师父是 3/4 高清像→放大下沉，下摆压底边、更顶天立地 */}
      <Abs x={v.px} y={v.isMaster ? 188 : 392} w={920} h={v.isMaster ? 1548 : 1200}>
        <img className="vh-portrait" src={v.portrait} alt={v.name} />
      </Abs>

      <Abs x={2029} y={409} w={1007} h={900} className="vh-panel" />
      {ACTIONS.map((a) => (
        <Abs key={a.label} x={a.cx} y={a.cy} w={301} h={301} className="vh-action" onClick={() => openModal(a.kind)}>
          {a.label}
        </Abs>
      ))}

      {/* 师父的家：桌上百科书 → 百科（Figma Group 201 → 24:659）。右上角也有百科快捷键。 */}
      {v.isMaster && (
        <Abs x={388} y={1352} w={576} h={300} className="mh-books">
          {['纹样', '材料', '历史', '冷知识'].map((label) => (
            <button key={label} className="mh-book" onClick={() => go('encyclopedia')} title={`百科 · ${label}`}>
              百科
            </button>
          ))}
        </Abs>
      )}

      {/* 送礼 / 邀请 / 情报 弹层 */}
      {modal && (
        <>
          <Abs x={0} y={0} w={3148} h={1773} className="vh-modal-veil" onClick={close} />
          <Abs x={624} y={430} w={1900} h={910} className="vh-modal">
            <button className="vh-modal-close" onClick={close} title="返回">
              ×
            </button>

            {modal === 'gift' && (
              <>
                <span className="vh-modal-title">送礼给{v.name}</span>
                {giftMsg ? (
                  <span className="vh-modal-text">{giftMsg}</span>
                ) : (
                  <>
                    <span className="vh-modal-hint">{v.giftHint}</span>
                    <span className="vh-modal-opts">
                      {GIFTS.map((g) => (
                        <button
                          key={g.name}
                          className="vh-opt"
                          onClick={() =>
                            setGiftMsg(
                              g.ok
                                ? `${v.name}很喜欢，送给你一个香囊作为回礼，好感 +3`
                                : `${v.name}礼貌地收下了，但似乎不太中意……`,
                            )
                          }
                        >
                          {g.name}
                        </button>
                      ))}
                    </span>
                  </>
                )}
              </>
            )}

            {modal === 'invite' && (
              <>
                <span className="vh-modal-title">邀请{v.name}</span>
                <span className="vh-modal-text">要邀请我做什么呢？</span>
                <span className="vh-modal-opts">
                  {INVITES.map((it) => (
                    <button key={it.label} className="vh-opt" onClick={() => go(it.to)}>
                      {it.label}
                    </button>
                  ))}
                </span>
              </>
            )}

            {modal === 'intel' && (
              <>
                <span className="vh-modal-title">{v.name}的情报</span>
                <span className="vh-modal-text">{INTEL}</span>
              </>
            )}

            {modal === 'talk' && talkLines && (
              <>
                <span className="vh-modal-title">{v.name}</span>
                <span className="vh-modal-text">{talkLines[talkIdx]}</span>
                <span className="vh-modal-opts">
                  {talkIdx < talkLines.length - 1 ? (
                    <button className="vh-opt" onClick={() => setTalkIdx(talkIdx + 1)}>
                      下一句
                    </button>
                  ) : v.isMaster ? (
                    <button className="vh-opt" onClick={() => { close(); go('masterChat') }}>
                      去找师父聊聊
                    </button>
                  ) : (
                    <button className="vh-opt" onClick={close}>知道了</button>
                  )}
                </span>
              </>
            )}
          </Abs>
        </>
      )}

      <SceneChrome back={v.isMaster ? 'map' : 'village'} status={false} />
    </SceneRoot>
  )
}
