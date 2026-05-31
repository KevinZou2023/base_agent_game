import './MenuButton.css'

export interface MenuButtonProps {
  label: string
  onClick?: () => void
}

/** Dark-brown rounded menu button with a thin cream keyline and brush text.
 *  Sized to the Figma button (776 x 146, 70px text). */
export function MenuButton({ label, onClick }: MenuButtonProps) {
  return (
    <button type="button" className="menu-btn" onClick={onClick}>
      <span className="menu-btn-label">{label}</span>
    </button>
  )
}
