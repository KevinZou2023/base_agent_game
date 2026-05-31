import { useEffect, useState } from 'react'
import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { SceneChrome } from '../components/SceneChrome'
import './DyeScene.css'

// 染坊-等待时间 — Figma node 76:2183. Dark "dyeing in progress" overlay + countdown.
export function DyeWaitScene() {
  const [sec, setSec] = useState(5 * 60 + 23)
  useEffect(() => {
    const t = setInterval(() => setSec((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [])
  const mm = Math.floor(sec / 60)
  const ss = String(sec % 60).padStart(2, '0')

  return (
    <SceneRoot paper paperColor="#EFE9D9">
      <Abs x={97} y={1019} w={655} h={620} className="dye-swatch-wrap">
        <img className="dye-swatch" src="/art/pattern-cloud.png" alt="花纹" />
      </Abs>
      <Abs x={59} y={84} w={3021} h={1611} className="dye-wait-overlay" />
      <Abs x={1002} y={780} w={1220} h={260} className="dye-wait-timer">
        剩 {mm}分{ss}秒...
      </Abs>
      <SceneChrome back="map" />
    </SceneRoot>
  )
}
