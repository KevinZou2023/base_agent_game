import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { SceneChrome } from '../components/SceneChrome'
import { useNav } from '../app/nav'
import './EventScene.css'

// 村庄突发 — Figma node 28:1033. 阿花 offers a 采薯莨 quest.
export function EventScene() {
  const { go } = useNav()
  return (
    <SceneRoot bg="/art/master-bg.png">
      <Abs x={670} y={-415} w={906} h={2876}>
        <img className="ev-portrait" src="/art/master-portrait.png" alt="阿花" />
      </Abs>

      <Abs x={1333} y={432} w={1671} h={869} className="ev-panel" />
      <Abs x={1780} y={600} w={1093} h={200} className="ev-text">
        今天天气真不错啊，你可以帮我去采一些薯莨吗？我可以给你一些我打的穗子作为报酬。
      </Abs>
      <Abs x={1900} y={850} w={820} h={150} className="ev-quest">
        任务：采集 5 个薯莨　奖励：阿花的穗子 ×3
      </Abs>

      <Abs x={2346} y={1170} w={293} h={116}>
        <button className="ev-btn" onClick={() => go('village')}>
          拒绝
        </button>
      </Abs>
      <Abs x={2684} y={1170} w={293} h={116}>
        <button className="ev-btn ev-accept" onClick={() => go('mountain')}>
          同意
        </button>
      </Abs>

      <SceneChrome back="village" />
    </SceneRoot>
  )
}
