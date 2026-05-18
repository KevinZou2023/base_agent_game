# 艺镜工坊 · 香云纱后端 (feiyi-game-backend)

非遗香云纱 AI Agent 教学与作品生成后端。基于 FastAPI + DashScope (Qwen function calling + 通义万相) + ChromaDB + SQLite。

## 总体架构

```
Unity 前端 (轻量 2D 村落 + 3D 工坊)
        ↓ HTTP
   FastAPI 网关 (本项目)
        │
        ├── 师傅 Agent (混合架构)
        │     ├── [安全护栏] process_rule  ← 总是确定性运行
        │     └── [Agent 决策] Qwen function calling
        │           ├── knowledge_search
        │           ├── teaching_strategy
        │           └── learning_path
        │
        ├── AI 生图流水线
        │     ├── texture_prompt (参数→prompt)
        │     ├── 通义万相 wanx-v1
        │     └── file_store (本地静态资源)
        │
        ├── 评分 + 师傅口语化点评 (Qwen)
        │
        └── 用户状态 (SQLite + SQLAlchemy 2.0)
```

## 核心接口

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

## 快速开始

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

## 三个验证脚本

```powershell
# 验证 DashScope API key 有效，打印 request_id
python scripts/verify_api.py

# 9 个场景演示 Agent 行为（含函数调用 trace）
python scripts/smoke_test.py

# 全链路 e2e（health → user → chat → artwork → scoring）
python scripts/e2e_test.py
python scripts/e2e_test.py --skip-artwork   # 不烧生图额度
```

## Agent 架构关键设计

### 混合 Agent（不是脚本化 NPC）

- **确定性安全护栏**：`process_rule` 在每个 turn 开始时自动运行，结果**强制注入** LLM 的 user message。LLM 无法跳过工艺规则判断。
- **Agent 决策层**：LLM 通过 Qwen function calling 动态决定调用哪些工具：
  - `knowledge_search` — 学徒提问、或需要案例对比时
  - `teaching_strategy` — 需要决定口吻强度时
  - `learning_path` — 学徒反复犯同样错误时
  - 或**不调任何工具**，直接给师傅回复
- **可解释性**：每次的 tool_call 链都记录在 `AgentResponse.debug.tool_calls`，可复盘 Agent 的决策路径。

### 工艺规则即论文卖点

13 条规则覆盖香云纱主要失败模式（薯莨/晒莨/过乌/水洗/晾晒），每条规则:
- 输入：玩家参数
- 输出：`risk_tag` + 师傅口语化原因 + 改法建议
- 与 `failure_cases.json` 知识库中 13 个案例一一对应
- 评分时每条规则映射到一个评分维度

## 项目结构

```
app/
├── main.py                  # FastAPI 入口（4 路由 + CORS + 限流 + 静态资源）
├── config.py                # pydantic-settings 读 .env
├── api/
│   ├── deps.py              # FastAPI 依赖（Agent / DB session）
│   └── routes/
│       ├── master.py        # /api/v1/master/chat
│       ├── artwork.py       # /api/v1/artwork/generate
│       ├── scoring.py       # /api/v1/scoring/{id}
│       └── user_state.py    # /api/v1/user/{id}/state
├── agent/
│   ├── master_agent.py      # Agent loop with function calling
│   ├── llm_client.py        # DashScope/DeepSeek 抽象层
│   ├── tool_registry.py     # Tool dataclass + 自动 JSON Schema
│   └── prompts.py           # 师傅人设 + 工具选择引导
├── tools/
│   ├── process_rule.py      # 规则引擎包装（确定性，不进 registry）
│   ├── operation_perception.py
│   ├── knowledge_search.py
│   ├── teaching_strategy.py / teaching_strategy_tool.py
│   ├── learning_path.py
│   ├── scoring.py           # 5 维评分
│   ├── teaching_feedback.py # LLM 总评 + 下一关推荐
│   ├── texture_prompt.py    # 参数→通义万相 prompt
│   └── image_generation.py  # 通义万相调用
├── data/
│   ├── schemas.py           # 全部 Pydantic 模型
│   └── rules.py             # 13 条香云纱规则矩阵
└── storage/
    ├── db.py                # SQLAlchemy 2.0 ORM
    ├── vector_db.py         # ChromaDB 封装
    ├── embeddings.py        # DashScope text-embedding-v3
    └── file_store.py        # 本地图片下载 + 静态 URL

data/
├── processed/               # 37 条结构化知识（craft / material / param / failure）
└── rules/                   # YAML 镜像（可读版本）

storage/                     # 运行时（gitignored）
├── chroma/                  # 向量库持久化
├── images/                  # 生成图
└── feiyi.db                 # SQLite

scripts/
├── seed_data.py             # 灌库
├── smoke_test.py            # 9 个 Agent 场景
├── e2e_test.py              # 全链路 e2e
└── verify_api.py            # DashScope 用量核对

tests/                       # 70+ pytest 用例
```

## 开发周期

4 周（2026-05-18 → 2026-06-14），按周交付：

- ✅ Week 1：数据库 + 规则引擎（37 条数据 + 13 条规则 + 29 测试）
- ✅ Week 2：MasterAgent 混合架构（Qwen function calling + 18 测试）
- ✅ Week 3：FastAPI 4 接口 + 通义万相生图（70 测试 + 完整 e2e 验证）
- ✅ Week 4：评分 LLM 点评 + 限流 + README

## 注意事项

- `.env` 包含 API key，**严禁提交**（`.gitignore` 已配置）
- `storage/` 包含 SQLite 和向量库，运行时自动创建
- 单次 artwork 生成 ~30-60 秒（通义万相同步调用）
- 通义万相目前免费额度约 500 次/月，超出后约 ¥0.16/张
