import { GOLDEN_PATH } from '../app/quest'
import './QuestTracker.css'

/** Top-left quest log for the golden path. `step` = -1 not started, 0..n active, n done. */
export function QuestTracker({ step }: { step: number }) {
  const allDone = step >= GOLDEN_PATH.length
  return (
    <div className="quest-tracker">
      <div className="quest-tracker-head">
        <span className="quest-tracker-seal">务</span>
        <span>学 艺 录</span>
      </div>

      {step < 0 ? (
        <div className="quest-tracker-hint">村中寻「阿婆」,领取学艺任务</div>
      ) : (
        <ol className="quest-tracker-list">
          {GOLDEN_PATH.map((q, i) => {
            const state = i < step ? 'done' : i === step ? 'active' : 'todo'
            return (
              <li key={q.id} className={`quest-step quest-${state}`}>
                <span className="quest-mark">{state === 'done' ? '✓' : i + 1}</span>
                <span className="quest-text">{q.objective}</span>
              </li>
            )
          })}
        </ol>
      )}

      {allDone && <div className="quest-tracker-done">学艺有成 · 香云纱成!</div>}
    </div>
  )
}
