import { Abs } from './Abs'
import './TopStatusBar.css'

const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

export interface TopStatusBarProps {
  /**游戏内分钟数（从0开始），驱动时钟和时辰显示 */
  gameTime?: number
  weather?: string
  temp?: string
  /** 宜 (auspicious) activity, e.g. 晒布 */
  auspicious?: string
}

/** Top-center status plaque — time, ganzhi seal, weather, today's 宜. */
export function TopStatusBar({
  gameTime,
  weather = '晴朗',
  temp = '26°C',
  auspicious = '晒布',
}: TopStatusBarProps) {
  // gameTime 是游戏内分钟数，1 天 = 24 * 60 分钟 = 1440 分钟
  const TOTAL_MINUTES = 24 * 60
  const total = ((gameTime ?? 0) % TOTAL_MINUTES + TOTAL_MINUTES) % TOTAL_MINUTES
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  // 十二时辰：每 2 小时一个时辰
  const shichen = SHICHEN[Math.floor(hours / 2) % 12]

  return (
    <>
      <Abs x={1257} y={80} w={728} h={222} className="status-pill" />
      <Abs x={1290} y={140} w={60} h={58} className="status-seal">
        {shichen}
      </Abs>
      <Abs x={1353} y={122} w={218} h={95} className="status-time">
        {timeStr}
      </Abs>
      <Abs x={1576} y={138} w={62} h={62} className="status-weather-icon">
        <svg viewBox="0 0 100 100" width="62" height="62" aria-hidden>
          <circle cx="38" cy="40" r="20" fill="#D9A441" />
          <path
            d="M40 68 a22 22 0 0 1 22-22 a20 20 0 0 1 19 14 a16 16 0 0 1 -3 31 H44 a16 16 0 0 1 -4 -23 z"
            fill="#9AA0A6"
          />
        </svg>
      </Abs>
      <Abs x={1638} y={118} w={130} h={102} className="status-weather">
        {weather}
      </Abs>
      <Abs x={1786} y={118} w={199} h={102} className="status-temp">
        {temp}
      </Abs>
      <Abs x={1353} y={212} w={520} h={70} className="status-auspicious">
        宜&nbsp;{auspicious}
      </Abs>
    </>
  )
}
