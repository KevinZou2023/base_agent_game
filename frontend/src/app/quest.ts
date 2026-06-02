import type { SceneId } from './nav'

/** One objective in the golden-path quest line. Visiting `targetLoc` advances it. */
export interface QuestStep {
  id: string
  objective: string
  targetLoc: SceneId
}

/** The demo's golden path — follows the real 香云纱 craft order:
 *  拜师 → 采薯莨 → 浸染 → 晒莨 → 过乌 → 入坊成衣. */
export const GOLDEN_PATH: QuestStep[] = [
  { id: 'master', objective: '拜师学艺 · 去「师父的家」', targetLoc: 'master' },
  { id: 'gather', objective: '采薯莨 · 去「青翠山」', targetLoc: 'mountain' },
  { id: 'dye', objective: '浸染莨水 · 去「染坊」', targetLoc: 'dye' },
  { id: 'sun', objective: '晒莨 · 去「晾晒场」', targetLoc: 'drying' },
  { id: 'mud', objective: '河泥过乌 · 去「乌尔河」', targetLoc: 'river' },
  { id: 'craft', objective: '入坊成衣 · 去「织布坊」', targetLoc: 'weaving' },
]

// quest step: -1 = not started, 0..len-1 = active step, len = all done
const KEY = 'liangzuo.quest_step'

export const loadQuestStep = (): number => {
  const raw = localStorage.getItem(KEY)
  const v = raw == null ? -1 : Number(raw)
  return Number.isInteger(v) ? v : -1
}
export const saveQuestStep = (s: number): void => localStorage.setItem(KEY, String(s))
