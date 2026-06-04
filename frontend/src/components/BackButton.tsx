import { Abs } from './Abs'
import './BackButton.css'

/** Circular back button — Figma Group 202 @73,1378 (312x312), bottom-left. */
export function BackButton({ onClick }: { onClick?: () => void }) {
  return (
    <Abs x={73} y={1378} w={312} h={312} style={{ zIndex: 60 }}>
      <button type="button" className="back-btn" onClick={onClick} aria-label="返回">
        <svg viewBox="0 0 100 100" width="150" height="150" aria-hidden>
          <path
            d="M62 24 L34 50 L62 76"
            fill="none"
            stroke="#837664"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </Abs>
  )
}
