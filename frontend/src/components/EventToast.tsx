import { useState } from 'react'
import { dismissEvent } from '../api/client'
import { useNav } from '../app/nav'
import './EventToast.css'

export interface EventToastProps {
  eventId: string
  npcName: string
  npcSprite?: string
  messages: string[]
  location?: string | null
}

export function EventToast({ eventId, npcName, npcSprite, messages, location }: EventToastProps) {
  const { go } = useNav()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const handleDismiss = async () => {
    setDismissed(true)
    await dismissEvent(eventId)
  }

  const handleView = () => {
    setDismissed(true)
    dismissEvent(eventId).catch(() => {/* ignore */})
    if (location) {
      try {
        go(location as Parameters<typeof go>[0])
      } catch (e) {
        console.warn('[EventToast] scene go error:', e)
      }
    }
  }

  return (
    <div className="event-toast" onClick={handleDismiss}>
      <div className="event-toast-inner">
        <div className="event-toast-portrait">
          {npcSprite ? (
            <img src={npcSprite} alt={npcName} />
          ) : (
            <div className="event-toast-portrait-placeholder">{npcName[0]}</div>
          )}
        </div>
        <div className="event-toast-content">
          <div className="event-toast-npc">{npcName}</div>
          {(messages ?? []).map((msg, i) => (
            <div key={i} className="event-toast-msg">{msg ?? ''}</div>
          ))}
        </div>
        <div className="event-toast-actions">
         <button className="event-toast-btn view" onClick={handleView}>
            查看
          </button>
          <button className="event-toast-btn later" onClick={handleDismiss}>
            稍后
          </button>
        </div>
      </div>
    </div>
  )
}