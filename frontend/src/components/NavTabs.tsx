import { Abs } from './Abs'
import { useNav, type SceneId } from '../app/nav'
import './NavTabs.css'

interface TabDef {
  id: SceneId
  label: string
  x: number
}

// Figma 顶部选项 (node 65:267): five vertical signboards, y=18, each 165x325.
const TABS: TabDef[] = [
  { id: 'encyclopedia', label: '百科', x: 2087 },
  { id: 'map', label: '地图', x: 2288 },
  { id: 'warehouse', label: '仓库', x: 2486 },
  { id: 'space', label: '空间', x: 2684 },
  { id: 'settings', label: '设置', x: 2882 },
]

export function NavTabs() {
  const { scene, go } = useNav()
  return (
    <>
      {TABS.map((t) => (
        <Abs key={t.id} x={t.x} y={18} w={165} h={325}>
          <button
            type="button"
            className={`nav-tab${scene === t.id ? ' is-active' : ''}`}
            onClick={() => go(t.id)}
          >
            <span className="nav-tab-face">
              <span className="nav-tab-text">{t.label}</span>
            </span>
          </button>
        </Abs>
      ))}
    </>
  )
}
