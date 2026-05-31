import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { BackButton } from '../components/BackButton'
import { useNav, type SceneId } from '../app/nav'

const NAMES: Record<string, string> = {
  intro: '游戏介绍',
  personal: '个人空间',
  encyclopedia: '百科',
  warehouse: '仓库',
  space: '空间',
  settings: '设置',
  village: '村庄',
  river: '乌尔河',
  master: '师父的家',
  weaving: '织布坊',
  dye: '染坊',
  drying: '晾晒场',
  mountain: '青翠山',
}

// Scenes reached from the start menu return there; everything else to the map.
const TO_START: SceneId[] = ['intro', 'personal']

/** Stand-in for scenes not yet built. Keeps navigation working end-to-end. */
export function PlaceholderScene() {
  const { scene, go } = useNav()
  const name = NAMES[scene] ?? scene
  const back: SceneId = TO_START.includes(scene) ? 'start' : 'map'
  return (
    <SceneRoot>
      <Abs
        x={0}
        y={0}
        w={3148}
        h={1773}
        style={{
          display: 'grid',
          placeItems: 'center',
          background: '#f2e4c5',
        }}
      >
        <div style={{ textAlign: 'center', color: '#543f27' }}>
          <div style={{ fontFamily: 'var(--font-title)', fontSize: 260, lineHeight: 1.2 }}>
            {name}
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 70, opacity: 0.7 }}>
            建设中 · Coming soon
          </div>
        </div>
      </Abs>
      <BackButton onClick={() => go(back)} />
    </SceneRoot>
  )
}
