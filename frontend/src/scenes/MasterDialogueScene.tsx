import { useState } from 'react'
import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { TopStatusBar } from '../components/TopStatusBar'
import { NavTabs } from '../components/NavTabs'
import { BackButton } from '../components/BackButton'
import { TaskScroll } from '../components/TaskScroll'
import { useNav } from '../app/nav'
import './MasterDialogueScene.css'

const INTRO =
  '薯莨果是薯莨的球状块茎，长在地面上。只有当最大的薯莨果被人取走，底下的小薯果才能享有充分的养料，继续生长。因此，人们对薯莨的适度取用不仅不会损害薯莨、破坏植被，反而满足了薯莨生长的需要。'

const PRESETS = ['我想了解制作香云纱的详细', '香云纱制作有什么注意事项', '自由输入'] as const

// 师父对话 — Figma node 29:190. Visual-novel dialogue; 自由输入 → /master/chat (wired in M2).
export function MasterDialogueScene() {
  const { go } = useNav()
  const [reply, setReply] = useState(INTRO)

  const ask = (q: string) => {
    if (q === '自由输入') {
      const v = window.prompt('向师父提问：')
      if (v) setReply(`「${v}」\n\n（接入 /master/chat 后，这里由师父 Agent 实时作答）`)
      return
    }
    setReply(`「${q}」\n\n（接入 /master/chat 后，这里由师父 Agent 实时作答）`)
  }

  return (
    <SceneRoot bg="/art/master-bg.png">
      {/* 师父 portrait */}
      <Abs x={628} y={63} w={798} h={2197}>
        <img className="md-portrait" src="/art/master-portrait.png" alt="师父" />
      </Abs>

      {/* dialogue bubble + name tag */}
      <Abs x={1793} y={372} w={220} h={114} className="md-nametag">师父</Abs>
      <Abs x={1576} y={423} w={1369} h={592} className="md-bubble" />
      <Abs x={1811} y={520} w={1093} h={430} className="md-text">{reply}</Abs>

      {/* reply options */}
      {PRESETS.map((q, i) => (
        <Abs key={q} x={1774} y={1054 + i * 190} w={1149} h={138}>
          <button className="md-option" onClick={() => ask(q)}>
            {q}
          </button>
        </Abs>
      ))}

      <TaskScroll x={46} y={92} />
      <TopStatusBar />
      <NavTabs />
      <BackButton onClick={() => go('map')} />
    </SceneRoot>
  )
}
