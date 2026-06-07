import { useState } from 'react'
import { GOLDEN_PATH } from '../app/quest'
import './QuestTracker.css'

/** Top-left quest log for the golden path. `step` = -1 not started, 0..n active, n done. */
export function QuestTracker({
  step,
  onReset,
  completedSteps,
}: {
  step: number
  onReset: () => void
  completedSteps?: Set<number>
}) {
  const [confirming, setConfirming] = useState(false)
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
            const state = completedSteps?.has(i) ? 'done' : i < step ? 'done' : i === step ? 'active' : 'todo'
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

      {/* 重新开始按钮（任意时刻可触发） */}
      <button className="quest-reset-btn" onClick={() => setConfirming(true)}>
        {allDone ? '重新开始' : '重置进度'}
      </button>

      {/* 确认弹层 */}
      {confirming && (
        <>
          <div className="quest-confirm-veil" onClick={() => setConfirming(false)} />
          <div className="quest-confirm-box">
            <div className="quest-confirm-title">重新开始</div>
            <div className="quest-confirm-text">
              确定要重新开始吗？<br />
              当前学艺进度将被清除。<br />
              <em>（作品集不受影响）</em>
            </div>
            <div className="quest-confirm-btns">
              <button className="quest-confirm-btn cancel" onClick={() => setConfirming(false)}>
                取消
              </button>
              <button
                className="quest-confirm-btn confirm"
                onClick={() => {
                  setConfirming(false)
                  onReset()
                }}
              >
                确认重置
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
