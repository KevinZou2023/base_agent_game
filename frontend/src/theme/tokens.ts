/**
 * Design tokens extracted from the Figma file (key aSXxVI1amcxbrc1LRGo1IH).
 *
 * Coordinate strategy: we use the NATIVE Figma frame size (3148 x 1773) as the
 * logical canvas, so every x/y/w/h/fontSize taken from the node tree is used
 * verbatim — no division, no rounding error. <Stage> scales the whole canvas
 * down to the viewport (letterbox), preserving aspect ratio.
 */

export const STAGE_W = 3148
export const STAGE_H = 1773

export const colors = {
  /** outer ornate border (dark walnut brown) */
  borderOuter: '#5B3F1F',
  /** cream parchment panel inside the border */
  panelCream: '#F2E4C5',
  /** filled menu buttons + ink-blob location labels + tab frames */
  brownDeep: '#543F27',
  /** mid taupe used in tab/label inner rings + task panel */
  taupe: '#837664',
  taupeDark: '#6D5C48',
  /** light cream used for tab inner fill + label/nav text */
  cream: '#EBE5D7',
  creamAlt: '#EFE8DA',
  /** text on filled brown buttons */
  onButton: '#FFFFFF',
  /** status-bar 时辰 marker (red seal) */
  sealRed: '#C0392B',
  /** dark letterbox surround */
  letterbox: '#1a130a',
  ink: '#2b1d0e',
} as const

export const fonts = {
  title: "var(--font-title)",
  brush: "var(--font-brush)",
  ui: "var(--font-ui)",
} as const
