import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { BackButton } from '../components/BackButton'
import { NavTabs } from '../components/NavTabs'
import { useNav } from '../app/nav'
import './InfoScene.css'

// 设置 — no Figma frame; designed in-style.
export function SettingsScene() {
  const { go } = useNav()
  return (
    <SceneRoot paper paperColor="#F2E4C5">
      <Abs x={1145} y={210} w={858} h={300} className="info-title">
        设置
      </Abs>
      <Abs x={760} y={620} w={1628} h={760} className="settings-list">
        <label className="settings-row">
          <span>音乐音量</span>
          <input type="range" defaultValue={70} />
        </label>
        <label className="settings-row">
          <span>音效音量</span>
          <input type="range" defaultValue={85} />
        </label>
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
      <NavTabs />
      <BackButton onClick={() => go('map')} />
    </SceneRoot>
  )
}
