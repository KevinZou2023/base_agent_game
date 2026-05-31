import './OrnateFrame.css'

/**
 * The ornate picture-frame border shared by every scene: a dark-walnut outer
 * edge, a wide cream parchment mat, and a thin inner brown keyline, with
 * rounded corners. Rendered as concentric rings with a transparent center so
 * the scene painting shows through. Decorative (pointer-events: none).
 *
 * NOTE: this is a CSS approximation of the hand-drawn Figma frame. The final
 * pixel-level pass swaps in a transparent PNG overlay exported from the
 * `外部边框` node — drop it in as `.ornate-frame > img` without touching scenes.
 */
export function OrnateFrame() {
  return (
    <div className="ornate-frame" aria-hidden>
      <div className="of-ring of-brown" />
      <div className="of-ring of-cream" />
      <div className="of-ring of-keyline" />
    </div>
  )
}
