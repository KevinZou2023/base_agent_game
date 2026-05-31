import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { MenuButton } from '../components/MenuButton'
import { useNav } from '../app/nav'
import './StartScene.css'

/** 开始 — Figma node 1:31. Title 莨作 + three menu buttons over the village painting. */
export function StartScene() {
  const { go } = useNav()
  return (
    <SceneRoot bg="/art/bg-start.png">
      {/* Title 莨作 — Yuji Mai brush, 350px (Figma @1147,289 858x507) */}
      <Abs x={1147} y={289} w={858} h={507} className="start-title">
        莨作
      </Abs>

      {/* Buttons — Figma rects @1188, y 904 / 1131 / 1358, 776x146 */}
      <Abs x={1188} y={904}>
        <MenuButton label="游戏介绍" onClick={() => go('intro')} />
      </Abs>
      <Abs x={1188} y={1131}>
        <MenuButton label="开始游戏" onClick={() => go('map')} />
      </Abs>
      <Abs x={1188} y={1358}>
        <MenuButton label="个人空间" onClick={() => go('personal')} />
      </Abs>
    </SceneRoot>
  )
}
