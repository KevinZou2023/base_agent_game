# 莨作 · 香云纱 — 非遗 AI 教学游戏

水墨风「香云纱」非遗教学游戏：可走村落 + 第一人称染坊 + AI 师傅教学 + 通义万相按工艺参数生成专属成品 + 五维评分点评。
**前端** React + Vite + three.js · **后端** FastAPI + 阿里云 DashScope（Qwen function calling + 通义万相）+ ChromaDB + SQLite。

> 香云纱（莨绸 / Gambiered Canton Gauze）：以薯莨汁反复浸染、河泥「过乌」氧化成色，正面乌黑透亮、背面棕红，一匹需数十道工序、半年日晒——被称为「软黄金」，国家级非物质文化遗产。

---

## 总体架构

```
React + Vite 前端 (frontend/)
  · 近 20 个水墨风 2D 场景 + 2 个 3D 场景（第一人称染坊 / 成品展示）
  · 可走主世界 · 主线任务 · NPC 对话 · 作品集/仓库
        │
        │  HTTP（dev 下 vite 代理 /api /static /health → :8000）
        ▼
   FastAPI 网关 (app/)
        │
        ├── 师傅 Agent（混合架构）
        │     ├── [安全护栏] process_rule  ← 每轮确定性运行，强制注入 LLM
        │     └── [Agent 决策] Qwen function calling
        │           ├── knowledge_search   （RAG 检索工艺案例）
        │           ├── teaching_strategy  （决定口吻强度）
        │           └── learning_path      （反复犯错时给路径）
        │
        ├── AI 生图流水线：texture_prompt（参数→prompt）→ 通义万相 wanx-v1 → file_store（本地静态资源）
        ├── 五维评分 + 师傅口语化点评（Qwen）
        └── 用户状态（SQLite + SQLAlchemy 2.0）
```

## 玩法主线（黄金路径）

```
拜师 → 采薯莨 → 浸染(选花纹+反复浸染次数) → 晒莨 → 过乌 → 入坊成衣
                                                          │
              每一步操作写入工艺参数（薯莨浓度/浸染次数/晒莨天数/过乌泥料…）
                                                          ▼
        完成制作 → 通义万相按你的参数生成专属香云纱 → 贴到 3D 成品旋转展示
                 → 五维评分（工艺/纹样/色彩/文化/进步）+ 师傅点评结算
                 → 成品入「成品库 / 仓库」（localStorage 持久化）
```

玩家的真实操作 → 工艺参数 → 既喂给**师傅 Agent**（实时风险提示与教学），也喂给**通义万相**（生成的纹样与成色随操作变化）。

---

## 前端 (frontend/)

- **技术栈**：React 18 · Vite 6 · TypeScript · three.js（`@react-three/fiber` / `drei` / `postprocessing`）
- **场景**：从 Figma（原生 3148×1773 画布，`<Stage>` 等比缩放）还原的水墨风 2D 场景，外加 2 个 3D 场景——第一人称染坊（WASD + 指针锁定）与成品展示（旋转绸缎 + 后期 bloom/vignette/film grain）。
- **可走主世界**：星露谷式自由行走，dt 时间制移动 + 加减速 + 距离锁定踏步弹跳；碰撞地形、跟随相机、天气切换、NPC 对话与任务引导。
- **AI 透视面板**：成品展示页实时复盘 MasterAgent 一次推理链（操作感知→规则引擎→函数调用→RAG→师傅回复→生图→评分），把"看不见的后端"可视化。
- **离线优雅降级**：`api/client.ts` 先打真实接口，任何失败自动回退 mock 数据并打「离线示范」标——后端没起也能完整跑通演示。

```powershell
cd frontend
npm install
npm run dev        # http://localhost:5173
# dev server 自动把 /api /static /health 代理到后端 :8000
npm run typecheck  # tsc --noEmit
npm run build      # 产物在 frontend/dist
```

---

## 后端 (app/)

### 核心接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/v1/master/chat` | 师傅 Agent 对话，返回口语化反馈+风险标签+推荐改进 |
| POST | `/api/v1/artwork/generate` | 触发通义万相生图，下载到本地后返回静态 URL |
| GET | `/api/v1/scoring/{artwork_id}` | 5 维评分 + 师傅口语化总评 + 下一关推荐 |
| GET | `/api/v1/user/{player_id}/state` | 玩家状态、作品列表、最近风险 |
| PUT | `/api/v1/user/{player_id}/state` | 更新玩家昵称/等级 |
| GET | `/static/images/{filename}` | 生成图静态资源 |
| GET | `/health` | 健康检查 |
| GET | `/docs` | Swagger UI |

### 快速开始

```powershell
# 1. 创建 conda 环境
conda create -n feiyi_game python=3.11 -y
conda activate feiyi_game

# 2. 安装依赖
pip install -e ".[dev]"

# 3. 配置密钥（阿里云 DashScope）
cp .env.example .env
# 在 .env 里设 DASHSCOPE_API_KEY=sk-...

# 4. 灌入香云纱知识库 (~30s)
python scripts/seed_data.py --reset

# 5. 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 6. 验证
#   - 浏览器打开 http://localhost:8000/docs
#   - 或跑 e2e：python scripts/e2e_test.py
```

### 三个验证脚本

```powershell
python scripts/verify_api.py             # 验证 DashScope key 有效，打印 request_id
python scripts/smoke_test.py             # 9 个场景演示 Agent 行为（含函数调用 trace）
python scripts/e2e_test.py               # 全链路 e2e（health → user → chat → artwork → scoring）
python scripts/e2e_test.py --skip-artwork  # 不烧生图额度
```

### Agent 架构关键设计

**混合 Agent（不是脚本化 NPC）**

- **确定性安全护栏**：`process_rule` 在每个 turn 开始时自动运行，结果**强制注入** LLM 的 user message，LLM 无法跳过工艺规则判断。
- **Agent 决策层**：LLM 通过 Qwen function calling 动态决定调用 `knowledge_search` / `teaching_strategy` / `learning_path`，或不调任何工具直接回复。
- **可解释性**：每次 tool_call 链记录在 `AgentResponse.debug.tool_calls`，可复盘 Agent 的决策路径（前端 AI 透视面板即据此可视化）。

**工艺规则即论文卖点**

13 条规则覆盖香云纱主要失败模式（薯莨/晒莨/过乌/水洗/晾晒），每条：输入玩家参数 → 输出 `risk_tag` + 师傅口语化原因 + 改法建议，与 `failure_cases.json` 中 13 个案例一一对应，评分时每条映射到一个评分维度。

---

## 项目结构

```
frontend/                    # React + Vite 前端
├── src/
│   ├── app/                 # App.tsx（场景路由）· nav.ts · GameState.tsx（玩家状态/作品/AI 闭环）· quest.ts
│   ├── scenes/              # 全部场景（2D 水墨场景 + WorkshopScene/Showcase3DScene 3D 场景）
│   ├── components/          # Stage/Abs/Character/NpcDialogue/QuestTracker/AIInsightOverlay…
│   ├── three/               # SilkCloth（绸缎 3D 网格 + 物理材质）
│   ├── api/                 # client.ts（含 mock 回退）· types.ts（后端 schema 镜像）
│   └── theme/               # Figma 设计 token
└── vite.config.ts           # /api /static /health 代理到 :8000

app/                         # FastAPI 后端
├── main.py                  # 入口（4 路由 + CORS + 限流 + 静态资源）
├── config.py                # pydantic-settings 读 .env
├── api/routes/              # master / artwork / scoring / user_state
├── agent/                   # master_agent · llm_client · tool_registry · prompts
├── tools/                   # process_rule · knowledge_search · teaching_strategy · learning_path
│                            #  · scoring · teaching_feedback · texture_prompt · image_generation
├── data/                    # schemas.py（Pydantic 模型）· rules.py（13 条香云纱规则）
└── storage/                 # db（SQLAlchemy 2.0）· vector_db（ChromaDB）· embeddings · file_store

data/processed/              # 37 条结构化知识（craft / material / param / failure）
scripts/                     # seed_data · smoke_test · e2e_test · verify_api
tests/                       # 70+ pytest 用例
```

---

## 开发节奏

- **后端**（4 周，2026-05-18 → 2026-06-14）
  - ✅ Week 1：数据库 + 规则引擎（37 条数据 + 13 条规则 + 29 测试）
  - ✅ Week 2：MasterAgent 混合架构（Qwen function calling + 18 测试）
  - ✅ Week 3：FastAPI 4 接口 + 通义万相生图（70 测试 + 完整 e2e）
  - ✅ Week 4：评分 LLM 点评 + 限流 + README
- **前端**：从 Figma 还原水墨场景 → 可走主世界/任务/NPC → 3D 染坊与成品展示 → 接通 AI 生图+评分闭环 → 作品集/仓库。
- **待接入**：3D 工坊（同事产出，`weaving` 场景预留接入口）。

## 注意事项

- `.env` 含 API key，**严禁提交**（`.gitignore` 已配置）；`storage/` 为运行时目录，自动创建。
- 单次 artwork 生成 ~30–60 秒（通义万相同步调用）；前端"完成制作"在线时每次都会真实生成。**反复排练 UI 时建议先不开后端**，走 mock 即可不烧额度。
- 通义万相免费额度约 500 次/月，超出后约 ¥0.16/张。
```
