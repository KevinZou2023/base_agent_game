import { Abs } from './Abs'
import './TopStatusBar.css'

export interface TopStatusBarProps {
  time?: string
  /** 时辰 marker glyph shown in the red seal, e.g. 午 */
  shichen?: string
  weather?: string
  temp?: string
  /** 宜 (auspicious) activity, e.g. 晒布 */
  auspicious?: string
}

/** Top-center status banner — Figma node 65:267 (顶部选项 / Group 205 @1257,-28).
 *  Time of day, ganzhi seal, weather + temperature, and today's 宜 activity. */
export function TopStatusBar({
  time = '11:20',
  shichen = '午',
  weather = '晴朗',
  temp = '26°C',
  auspicious = '晒布',
}: TopStatusBarProps) {
  return (
    <>
      <Abs x={1257} y={-28} w={728} h={222} className="status-pill" />
      <Abs x={1284} y={17} w={84} h={81} className="status-seal">
        {shichen}
      </Abs>
      <Abs x={1353} y={14} w={218} h={95} className="status-time">
        {time}
      </Abs>
      <Abs x={1569} y={16} w={91} h={91} className="status-weather-icon">
        <svg viewBox="0 0 100 100" width="91" height="91" aria-hidden>
          <circle cx="38" cy="40" r="20" fill="#D9A441" />
          <path
            d="M40 68 a22 22 0 0 1 22-22 a20 20 0 0 1 19 14 a16 16 0 0 1 -3 31 H44 a16 16 0 0 1 -4 -23 z"
            fill="#9AA0A6"
          />
        </svg>
      </Abs>
      <Abs x={1638} y={10} w={130} h={102} className="status-weather">
        {weather}
      </Abs>
      <Abs x={1786} y={10} w={199} h={102} className="status-temp">
        {temp}
      </Abs>
      <Abs x={1353} y={104} w={520} h={70} className="status-auspicious">
        宜&nbsp;{auspicious}
      </Abs>
    </>
  )
}
