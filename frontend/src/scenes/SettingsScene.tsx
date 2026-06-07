import { useState } from 'react'
import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { BackButton } from '../components/BackButton'
import { NavTabs } from '../components/NavTabs'
import { useNav } from '../app/nav'
import { useGame } from '../app/GameState'
import './InfoScene.css'

const MUSIC_VOL_KEY = 'liangzuo.music_volume'
const MUSIC_ON_KEY = 'liangzuo.music_on'
const SFX_VOL_KEY = 'liangzuo.sfx_volume'
const VOLUME_EVENT = 'liangzuo.volume-changed'

function loadVolume(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key)
    return v !== null ? Math.max(0, Math.min(1, parseFloat(v))) : fallback
  } catch { return fallback }
}

function saveVolume(key: string, value: number) {
  try { localStorage.setItem(key, String(value)) } catch {}
}

function dispatchVolume(music: number, sfx: number) {
  window.dispatchEvent(new CustomEvent(VOLUME_EVENT, { detail: { music, sfx } }))
}

export function SettingsScene() {
  const { go } = useNav()
  const { clearWorks } = useGame()

  const [musicVol, setMusicVol] = useState(() => loadVolume(MUSIC_VOL_KEY, 0.35))
  const [sfxVol, setSfxVol] = useState(() => loadVolume(SFX_VOL_KEY, 0.85))
  const [musicOn, setMusicOn] = useState(() => localStorage.getItem(MUSIC_ON_KEY) !== 'off')
  const [clearing, setClearing] = useState(false)

  const handleMusicVolChange = (v: number) => {
    setMusicVol(v)
    saveVolume(MUSIC_VOL_KEY, v)
    dispatchVolume(v, sfxVol)
  }

  const handleSfxVolChange = (v: number) => {
    setSfxVol(v)
    saveVolume(SFX_VOL_KEY, v)
    dispatchVolume(musicVol, v)
  }

  const handleToggleMusic = () => {
    const next = !musicOn
    setMusicOn(next)
    try { localStorage.setItem(MUSIC_ON_KEY, next ? 'on' : 'off') } catch {}
    window.dispatchEvent(new CustomEvent('liangzuo.toggle-music'))
  }

  const handleClearWorks = () => setClearing(true)
  const confirmClear = () => {
    clearWorks()
    setClearing(false)
  }

  return (
    <SceneRoot paper paperColor="#F2E4C5">
      <Abs x={1145} y={210} w={858} h={300} className="info-title">
        设置
      </Abs>
      <Abs x={760} y={620} w={1628} h={760} className="settings-list">
        {/* 音乐开关 + 音量 */}
        <div className="settings-row">
          <span>音乐</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              className="settings-toggle"
              onClick={handleToggleMusic}
              style={{ background: musicOn ? '#4a7c59' : 'rgba(91,63,31,0.12)', color: musicOn ? '#fff' : '#543f27' }}
            >
              {musicOn ? '开' : '关'}
            </button>
            <input
              type="range"
              min={0} max={1} step={0.01}
              value={musicVol}
              onChange={(e) => handleMusicVolChange(parseFloat(e.target.value))}
              style={{ width: 220 }}
            />
            <span style={{ fontSize: 28, color: '#6d5c48', minWidth: 60 }}>
              {Math.round(musicVol * 100)}%
            </span>
          </div>
        </div>
        {/* 音效音量 */}
        <div className="settings-row">
          <span>音效</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <input
              type="range"
              min={0} max={1} step={0.01}
              value={sfxVol}
              onChange={(e) => handleSfxVolChange(parseFloat(e.target.value))}
              style={{ width: 220 }}
            />
            <span style={{ fontSize: 28, color: '#6d5c48', minWidth: 60 }}>
              {Math.round(sfxVol * 100)}%
            </span>
          </div>
        </div>
        <div className="settings-row">
          <span>全屏模式</span>
          <button
            className="settings-toggle"
            onClick={() => document.documentElement.requestFullscreen?.()}
          >
            开启
          </button>
        </div>
        <div className="settings-row settings-about">
          <span>关于</span>
          <span className="settings-about-text">莨作 · 香云纱 v0.1 — 非遗教学 demo</span>
        </div>
     </Abs>

      {/* 清空成品库入口 */}
      <Abs x={760} y={1420} w={1628} h={200} className="settings-list">
        <div className="settings-row">
          <span>清空成品库</span>
          <button className="settings-toggle danger" onClick={handleClearWorks}>
            清除
          </button>
        </div>
      </Abs>

      {/* 确认弹层 */}
      {clearing && (
        <>
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 80,
              background: 'rgba(0,0,0,0.45)', cursor: 'pointer',
            }}
            onClick={() => setClearing(false)}
          />
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)', zIndex: 81,
            width: 820, padding: '48px 56px 44px',
            background: 'linear-gradient(180deg, rgba(242,228,197,0.98), rgba(220,206,170,0.98))',
            border: '3px solid #5b3f1f', borderRadius: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
            fontFamily: 'var(--font-ui)', color: '#3a2a18', textAlign: 'center',
          }}>
            <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: '0.2em', color: '#543f27', marginBottom: 24 }}>
              清空成品库
            </div>
            <div style={{ fontSize: 32, lineHeight: 1.6, color: '#6d5c48', marginBottom: 36 }}>
              确定要清空所有作品吗？<br />此操作不可恢复。
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 40 }}>
              <button
                style={{
                  padding: '14px 52px', borderRadius: 10, fontSize: 32,
                  fontFamily: 'var(--font-ui)', cursor: 'pointer',
                  background: 'rgba(91,63,31,0.12)', border: '2px solid #5b3f1f',
                  color: '#543f27', letterSpacing: '0.1em',
                }}
                onClick={() => setClearing(false)}
              >
                取消
              </button>
              <button
                style={{
                  padding: '14px 52px', borderRadius: 10, fontSize: 32,
                  fontFamily: 'var(--font-ui)', cursor: 'pointer', border: 'none',
                  background: '#c0392b', color: '#fff', letterSpacing: '0.1em',
                }}
                onClick={confirmClear}
              >
                确认清除
              </button>
            </div>
          </div>
        </>
      )}

      <NavTabs />
      <BackButton onClick={() => go('map')} />
    </SceneRoot>
  )
}
