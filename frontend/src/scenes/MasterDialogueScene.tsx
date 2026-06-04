import { useState } from 'react'
import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { NavTabs } from '../components/NavTabs'
import { BackButton } from '../components/BackButton'
import { TaskScroll } from '../components/TaskScroll'
import { useNav } from '../app/nav'
import { useGame } from '../app/GameState'
import { masterChat } from '../api/client'
import type { AgentResponse } from '../api/types'
import './MasterDialogueScene.css'

const INTRO =
  '薯莨果是薯莨的球状块茎，长在地面上。只有当最大的薯莨果被人取走，底下的小薯果才能享有充分的养料，继续生长。因此，人们对薯莨的适度取用不仅不会损害薯莨、破坏植被，反而满足了薯莨生长的需要。'

const PRESETS = ['我想了解制作香云纱的详细', '香云纱制作有什么注意事项', '自由输入'] as const

// 师父对话 — Figma 29:190. Wired to POST /api/v1/master/chat (mock fallback).
export function MasterDialogueScene() {
  const { go } = useNav()
  const { player } = useGame()
  const [reply, setReply] = useState(INTRO)
  const [resp, setResp] = useState<AgentResponse | null>(null)
  const [mocked, setMocked] = useState(false)
  const [loading, setLoading] = useState(false)

  const ask = async (q: string) => {
    let message = q
    if (q === '自由输入') {
      const v = window.prompt('向师父提问：')
      if (!v) return
      message = v
    }
    setLoading(true)
    setResp(null)
    setReply('师父捻须思量……')
    const { data, mocked } = await masterChat({ player_state: player, message })
    setReply(data.master_reply)
    setResp(data)
    setMocked(mocked)
    setLoading(false)
  }

  return (
    <SceneRoot bg="/art/master-bg.png">
      <Abs x={628} y={188} w={798} h={1548}>
        <img className="md-portrait" src="/art/villager-master.png" alt="师父" />
      </Abs>

      <Abs x={1793} y={372} w={220} h={114} className="md-nametag">师父</Abs>
      <Abs x={1576} y={423} w={1369} h={592} className="md-bubble" />
      {mocked && (
        <Abs x={2740} y={446} w={180} h={56} className="md-mock-badge">离线示范</Abs>
      )}
      <Abs x={1811} y={500} w={1093} h={470} className="md-text">
        <div className="md-reply">{reply}</div>
        {resp && !loading && (resp.risk_tags.length > 0 || resp.recommended_actions.length > 0) && (
          <div className="md-meta">
            {resp.risk_tags.map((t) => (
              <span key={t} className="md-risk">⚠ {t}</span>
            ))}
            {resp.recommended_actions.length > 0 && (
              <span className="md-sugg">建议：{resp.recommended_actions.join('、')}</span>
            )}
          </div>
        )}
      </Abs>

      {PRESETS.map((q, i) => (
        <Abs key={q} x={1774} y={1054 + i * 190} w={1149} h={138}>
          <button className="md-option" onClick={() => ask(q)} disabled={loading}>
            {q}
          </button>
        </Abs>
      ))}

      <TaskScroll x={46} y={92} />
      <NavTabs />
      <BackButton onClick={() => go('master')} />
    </SceneRoot>
  )
}
