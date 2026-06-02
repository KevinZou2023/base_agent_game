import './NpcDialogue.css'

/** Presentational dialogue box — MapScene owns the line index & advancing. */
export function NpcDialogue({
  name,
  text,
  last,
  onAdvance,
}: {
  name: string
  text: string
  last: boolean
  onAdvance: () => void
}) {
  return (
    <div className="npc-dialogue" onClick={onAdvance}>
      <div className="npc-dialogue-box">
        <div className="npc-dialogue-name">{name}</div>
        <div className="npc-dialogue-text">{text}</div>
        <div className="npc-dialogue-next">{last ? '关闭 ▸ (E)' : '继续 ▸ (E)'}</div>
      </div>
    </div>
  )
}
