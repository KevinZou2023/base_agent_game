import { useEffect, useRef, useState } from 'react'
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

// Web Speech API detection
type SRSample = {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: { results: { length: number; item: (i: number) => { isFinal: boolean; 0: { transcript: string } } } }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void; stop: () => void
}
const SR = (() => {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => SRSample) | null
})()
const HAS_SPEECH = SR !== null

// 师父对话
export function MasterDialogueScene() {
  const { go } = useNav()
  const { player, completeQuestStep } = useGame()
  const [reply, setReply] = useState(INTRO)
  const [resp, setResp] = useState<AgentResponse | null>(null)
  const [mocked, setMocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sentences, setSentences] = useState<string[]>([INTRO])
  const [showIdx, setShowIdx] = useState(0)
  const [done, setDone] = useState(true)
  const completedRef = useRef(false)
  const hasStartedRef = useRef(false)

  // 语音输入状态
  const [listening, setListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [voiceText, setVoiceText] = useState('')
  const [speechError, setSpeechError] = useState<string | null>(null)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)

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
    setShowIdx(0)
    setDone(false)
    hasStartedRef.current = true
    const { data, mocked: mkd } = await masterChat({ player_state: player, message })
    const text = data.master_reply || ''
    const lines = text.split(/(?:[。！？]+)/).map((s: string) => s.trim()).filter(Boolean)
    if (lines.length === 0) lines.push(text || '（师父没有说话）')
    setSentences(lines)
    setShowIdx(0)
    setReply(lines[0])
    setResp(data)
    setMocked(mkd)
    setLoading(false)
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }

  const toggleListening = async () => {
    if (listening) {
      stopListening()
      return
    }
    setSpeechError(null)
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setSpeechError('麦克风权限被拒绝')
      return
    }
    if (!SR) {
      setSpeechError('当前浏览器不支持语音识别')
      return
    }
    const recognition = new SR()
    recognition.lang = 'zh-CN'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (e) => {
      let final = '', interim = ''
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results.item(i)
        if (r.isFinal) final += r[0].transcript
        else interim += r[0].transcript
      }
      setInterimText(interim)
      if (final.trim()) {
        setVoiceText(final.trim())
        setInterimText('')
        stopListening()
      }
    }
    recognition.onerror = (e) => {
      setSpeechError('语音识别出错：' + e.error)
      stopListening()
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setListening(true)
    setInterimText('')
    setVoiceText('')
    recognition.start()
  }

  const sendVoice = () => {
    if (voiceText.trim()) ask(voiceText.trim())
    setVoiceText('')
    setInterimText('')
  }

  const cancelVoice = () => {
    setVoiceText('')
    setInterimText('')
    stopListening()
  }

  // 按 E /空格 / 回车 继续显示下一句
  useEffect(() => {
    if (done) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setShowIdx((prev) => {
          const next = prev + 1
          if (next < sentences.length - 1) {
            setReply(sentences[next])
            return next
          } else if (next === sentences.length - 1) {
            setReply(sentences[next])
            setDone(true)
            return next
          }
          return prev
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [done, sentences])

  // 对话完成 →标记 step 0
  useEffect(() => {
    if (done && hasStartedRef.current && completedRef.current === false) {
      completedRef.current = true
      completeQuestStep(0)
    }
  }, [done])

  const currentText = sentences[showIdx] ?? reply
  const hasMore = showIdx < sentences.length - 1

  // 语音结果气泡是否可见
  const showVoiceBubble = interimText || voiceText || speechError

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
        <div className="md-reply">{currentText}</div>
        {!done && hasMore && (
          <div className="md-next-hint">按 E 继续 ▸</div>
        )}
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

      {/* 语音气泡 — 显示在"语音对话"按钮左侧 */}
      {showVoiceBubble && (
        <Abs x={628} y={1434} w={800} h={100}>
          <div className="md-bubble" style={{ opacity: 0.95, padding: '12px 20px', height: '100%' }}>
            <div className="md-text">
              {speechError ? (
                <div className="md-reply" style={{ fontSize: 36, color: '#c0392b' }}>{speechError}</div>
              ) : (
                <>
                  <div className="md-reply" style={{ fontSize: 38, color: '#7a6040', fontStyle: 'italic' }}>
                    {interimText || (voiceText ? `「${voiceText}」` : '')}
                  </div>
                  {voiceText && !interimText && (
                    <div className="md-voice-confirm">
                      <button className="md-voice-send" onClick={sendVoice}>发送</button>
                      <button className="md-voice-cancel" onClick={cancelVoice}>取消</button>
                    </div>
                  )}
                  {interimText && (
                    <div className="md-next-hint" style={{ fontSize: 26 }}>识别中…</div>
                  )}
                </>
              )}
            </div>
          </div>
        </Abs>
      )}

      {/* 语音按钮 — 紧挨在"自由输入"左侧 */}
      {HAS_SPEECH && (
        <Abs x={1464} y={1434} w={300} h={100}>
          <button
            className={`md-voice-btn${listening ? ' listening' : ''}`}
            onClick={toggleListening}
            disabled={loading}
          >
            语音对话
          </button>
        </Abs>
      )}

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