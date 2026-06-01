import { useEffect, useState } from 'react'
import './AIInsightOverlay.css'

type Kind = 'perceive' | 'rule' | 'think' | 'tool' | 'rag' | 'say' | 'image' | 'score'

interface TraceStep {
  kind: Kind
  tag: string
  title: string
  body: string
  mono?: boolean
}

const ICON: Record<Kind, string> = {
  perceive: '🖐',
  rule: '⚙',
  think: '🧠',
  tool: '🔧',
  rag: '📚',
  say: '🗣',
  image: '🎨',
  score: '📊',
}

/**
 * A captured MasterAgent run, replayed step by step.
 *
 * Every line here mirrors a real path through the backend (operation perception
 * → deterministic rule engine → LLM function-calling loop → ChromaDB RAG →
 * 师傅 reply → 通义万相 prompt → 五维评分). In P1 this static trace is swapped
 * for one baked from an actual run. The point is to make the invisible backend
 * *visible* — the single most "技术深度" thing in the whole demo.
 */
const TRACE: TraceStep[] = [
  { kind: 'perceive', tag: '操作感知', title: '学徒调整参数', body: '过乌停留 135 min · 泥浆厚度 0.35' },
  { kind: 'rule', tag: '规则引擎', title: 'R009 · wu_too_long · MEDIUM', body: '过乌时间过长 → 黑亮面发灰、缺乏光泽', mono: true },
  { kind: 'think', tag: 'Agent 决策', title: '第 1 轮 · 需要工艺依据', body: 'tool_choice = knowledge_search' },
  { kind: 'tool', tag: '工具调用', title: 'knowledge_search()', body: 'query="过乌时间过长 黑亮面发灰"  risk_tag="wu_too_long"  top_k=3', mono: true },
  { kind: 'rag', tag: 'RAG 命中', title: 'ChromaDB · text-embedding-v3', body: 'failure_case「过乌过度」d=0.18 · craft_step「过乌」d=0.24 · param「过乌时辰」d=0.31', mono: true },
  { kind: 'think', tag: 'Agent 决策', title: '第 2 轮 · 依据充分', body: '生成师傅回复 · 教学策略 = warn' },
  { kind: 'say', tag: '师傅', title: '顺德伦教 · 香云纱老师傅', body: '后生，过乌唔系越耐越好。135 分钟太耐咯，黑亮面会发灰冇光泽——下次控制喺 90 分钟内，泥唔好刷咁厚。' },
  { kind: 'image', tag: '通义万相', title: '按你的真实参数生成', body: 'prompt="…正面黑亮光泽，因过乌过度局部发灰…" → wanx-v1', mono: true },
  { kind: 'score', tag: '五维评分', title: '色彩协调度 −7', body: '工艺 90 · 纹样 90 · 色彩 83 · 文化 90 · 进步 +3', mono: true },
]

export function AIInsightOverlay() {
  const [n, setN] = useState(0)

  useEffect(() => {
    if (n >= TRACE.length) return
    const t = window.setTimeout(() => setN((v) => v + 1), n === 0 ? 700 : 850)
    return () => window.clearTimeout(t)
  }, [n])

  return (
    <div className="ai-insight">
      <div className="ai-insight-head">
        <span className="ai-insight-dot" />
        <span className="ai-insight-title">
          AI 透视 · <b>MasterAgent</b> 实时推理
        </span>
        <span className="ai-insight-live">● LIVE</span>
      </div>

      <div className="ai-insight-body">
        {TRACE.slice(0, n).map((s, i) => (
          <div className={`ai-step ${s.kind}`} key={i}>
            <div className="ai-step-ic">{ICON[s.kind]}</div>
            <div>
              <div className="ai-step-tag">{s.tag}</div>
              <div className="ai-step-title">{s.title}</div>
              <div className={`ai-step-body${s.mono ? ' mono' : ''}`}>{s.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="ai-insight-foot">Qwen · 函数调用 · RAG 检索 · 规则引擎 · 通义万相</div>
    </div>
  )
}
