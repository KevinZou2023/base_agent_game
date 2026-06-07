import { useEffect, useRef } from 'react'

const AUDIO_SRC = '/audio/bgm.mp3'
const TOGGLE_EVENT = 'liangzuo.toggle-music'
const VOLUME_EVENT = 'liangzuo.volume-changed'
const MUSIC_VOL_KEY = 'liangzuo.music_volume'
const MUSIC_ON_KEY = 'liangzuo.music_on'

function loadVolume(): number {
  try {
    const v = localStorage.getItem(MUSIC_VOL_KEY)
    return v !== null ? Math.max(0, Math.min(1, parseFloat(v))) : 0.35
  } catch { return 0.35 }
}

export function AudioManager() {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const audio = new Audio(AUDIO_SRC)
    audio.loop = true
    audio.volume = loadVolume()
    audioRef.current = audio

    // 恢复开关状态
    if (localStorage.getItem(MUSIC_ON_KEY) !== 'off') {
      audio.play().catch(() => {})
    }

    // 监听切换事件
    const toggleHandler = () => {
      if (!audioRef.current) return
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {})
        try { localStorage.setItem(MUSIC_ON_KEY, 'on') } catch {}
      } else {
        audioRef.current.pause()
        try { localStorage.setItem(MUSIC_ON_KEY, 'off') } catch {}
      }
    }

    // 监听音量变化事件
    const volumeHandler = (e: CustomEvent<{ music: number; sfx: number }>) => {
      if (!audioRef.current) return
      audioRef.current.volume = e.detail.music
      try { localStorage.setItem(MUSIC_VOL_KEY, String(e.detail.music)) } catch {}
    }

    window.addEventListener(TOGGLE_EVENT, toggleHandler)
    window.addEventListener(VOLUME_EVENT, volumeHandler as EventListener)

    return () => {
      window.removeEventListener(TOGGLE_EVENT, toggleHandler)
      window.removeEventListener(VOLUME_EVENT, volumeHandler as EventListener)
      audio.pause()
      audioRef.current = null
    }
  }, [])

  return null
}