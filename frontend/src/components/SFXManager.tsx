import { useEffect } from 'react'

const SFX_FILES = {
  click: '/audio/click.mp3',
  // 可扩展更多音效
}

const VOLUME_EVENT = 'liangzuo.volume-changed'
const SFX_VOL_KEY = 'liangzuo.sfx_volume'

function loadSfxVolume(): number {
  try {
    const v = localStorage.getItem(SFX_VOL_KEY)
    return v !== null ? Math.max(0, Math.min(1, parseFloat(v))) : 0.85
  } catch { return 0.85 }
}

/** 全局播放音效的函数，可在任意组件调用 */
export function playSfx(name: keyof typeof SFX_FILES = 'click', vol?: number) {
  const volume = vol ?? loadSfxVolume()
  try {
    const audio = new Audio(SFX_FILES[name])
    audio.volume = volume
    audio.play().catch(() => {})
  } catch {}
}

let sfxVolume = loadSfxVolume()
let lastPlay = 0 // 防抖：限制连续触发最小间隔（ms）

export function SFXManager() {
  useEffect(() => {
    // 监听音量变化
    const volHandler = (e: CustomEvent<{ music: number; sfx: number }>) => {
      sfxVolume = e.detail.sfx
    }
    window.addEventListener(VOLUME_EVENT, volHandler as EventListener)

    // 全局按钮点击音效（防抖 80ms）
    const clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('button')) return
      const now = Date.now()
      if (now - lastPlay < 80) return
      lastPlay = now
      playSfx('click', sfxVolume)
    }
    document.addEventListener('pointerdown', clickHandler)

    return () => {
      window.removeEventListener(VOLUME_EVENT, volHandler as EventListener)
      document.removeEventListener('pointerdown', clickHandler)
    }
  }, [])

  return null
}