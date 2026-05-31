import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { BackButton } from '../components/BackButton'
import { useNav } from '../app/nav'
import './InfoScene.css'

// 游戏介绍 — no Figma frame; designed in-style.
export function IntroScene() {
  const { go } = useNav()
  return (
    <SceneRoot paper paperColor="#F2E4C5">
      <Abs x={1145} y={210} w={858} h={300} className="info-title">
        游戏介绍
      </Abs>
      <Abs x={520} y={580} w={2108} h={920} className="info-body">
        <p>
          《莨作》是一款以国家级非物质文化遗产「香云纱」为主题的水墨风经营养成游戏。
        </p>
        <p>
          你将扮演初入莨作村的学徒，在师父与乡邻的指点下，亲历香云纱古法工艺——上山采薯莨、下河捞河泥、染坊刷莨、晾晒场晒莨，直至成衣。
        </p>
        <p>
          每道工序的参数都会影响成品的成色与品相。完成作品后，师父 AI 会为你逐维点评、指出风险、推荐下一关。
        </p>
      </Abs>
      <BackButton onClick={() => go('start')} />
    </SceneRoot>
  )
}
