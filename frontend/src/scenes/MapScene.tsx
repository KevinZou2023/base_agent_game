import { SceneRoot } from '../components/SceneRoot'
import { Abs } from '../components/Abs'
import { TopStatusBar } from '../components/TopStatusBar'
import { NavTabs } from '../components/NavTabs'
import { BackButton } from '../components/BackButton'
import { Banner } from '../components/Banner'
import { TaskScroll } from '../components/TaskScroll'
import { useNav, type SceneId } from '../app/nav'
import './MapScene.css'

// On-map location labels — exact group positions from Figma node 1:773.
const LOCATIONS: { label: string; x: number; y: number; to: SceneId }[] = [
  { label: '村庄', x: 463, y: 255, to: 'village' },
  { label: '乌尔河', x: 856, y: 350, to: 'river' },
  { label: '仓库', x: 1005, y: 738, to: 'warehouse' },
  { label: '师父的家', x: 1621, y: 317, to: 'master' },
  { label: '空间', x: 2104, y: 501, to: 'space' },
  { label: '织布坊', x: 2098, y: 1210, to: 'weaving' },
  { label: '晾晒场', x: 2795, y: 352, to: 'drying' },
  { label: '染坊', x: 2829, y: 906, to: 'dye' },
  { label: '青翠山', x: 314, y: 1083, to: 'mountain' },
]

// 地图 weather states — base 地图 (1:773) + 地图-多云 (157:10626) + 地图-雨 (154:10419).
const WEATHER: Record<string, { weather: string; temp: string; auspicious: string; overlay?: string }> = {
  map: { weather: '晴朗', temp: '26°C', auspicious: '晒布' },
  mapCloudy: { weather: '多云', temp: '24°C', auspicious: '晾晒', overlay: 'cloudy' },
  mapRainy: { weather: '阴雨', temp: '21°C', auspicious: '休整', overlay: 'rainy' },
}
const ORDER: SceneId[] = ['map', 'mapCloudy', 'mapRainy']

/** 地图 — Figma node 1:773. The village hub, with cycling weather. */
export function MapScene() {
  const { scene, go } = useNav()
  const w = WEATHER[scene] ?? WEATHER.map
  const next = ORDER[(Math.max(0, ORDER.indexOf(scene)) + 1) % ORDER.length]

  return (
    <SceneRoot bg="/art/bg-map.png">
      {w.overlay && <Abs x={64} y={64} w={3020} h={1645} className={`weather-overlay weather-${w.overlay}`} />}

      <TaskScroll x={48} y={81} />

      {LOCATIONS.map((l) => (
        <Banner key={l.label} label={l.label} x={l.x} y={l.y} onClick={() => go(l.to)} />
      ))}

      <TopStatusBar weather={w.weather} temp={w.temp} auspicious={w.auspicious} />
      {/* click the weather banner to cycle sunny → cloudy → rainy */}
      <Abs x={1257} y={-28} w={728} h={222} className="weather-toggle" title="切换天气" onClick={() => go(next)} />

      <NavTabs />
      <BackButton onClick={() => go('start')} />
    </SceneRoot>
  )
}
