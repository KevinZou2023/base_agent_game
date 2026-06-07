# 莨作 · 香云纱 — 运行指南

## 项目概述

**莨作 · 香云纱**（Xiangyunsha）是一款水墨风非遗教学游戏，前端 React + Vite + TypeScript，后端 FastAPI + AI Agent。

### 已接入 AI 的功能

| 功能 | 说明 |
|---|---|
| 师傅 NPC 对话 | 走近阿婆/老爷爷按 E → AI 根据 NPC 人设动态生成回复 |
| AI 随机事件 | 每 30s 前端轮询 → 后端评估触发条件 → AI 生成事件通知 |
| 工坊 AI 指导 | 调整工艺参数时师傅给出实时反馈 |
| AI 生成作品 | 通义万相按玩家参数生成香云纱图像 |
| 五维评分 | 作品完成后 AI 给出多维评分与点评 |

---

## 环境要求

- **Node.js** ≥ 18
- **Python** ≥ 3.11（需要 conda 或 venv）
- **Conda 环境**：`feiyi_game`
- **API Key**（见下文配置）

---

## 一、环境配置

### 1. 激活 conda 环境

```bash
conda activate feiyi_game
```

### 2. 配置 API Key

编辑项目根目录的 `.env` 文件，填入真实 API Key：

```bash
# 阿里云 DashScope（默认 LLM + 生图）
DASHSCOPE_API_KEY=sk-your-real-key-here

# DeepSeek（备用 LLM，可选）
DEEPSEEK_API_KEY=sk-your-real-key-here

# 其他保持默认：
APP_HOST=0.0.0.0
APP_PORT=8000
LLM_MODEL=qwen-plus
IMAGE_MODEL=wanx-v1
```

> **不填 API Key 会怎样？**
> - AI 功能走 fallback，不崩溃但无真实 AI 生成
> - 工坊参数指导返回固定文本（"嗯，这一步看上去稳，继续做下去。"）
> - 随机事件返回模板默认文本（`base_messages`）
> - 图像生成返回本地静态占位图

---

## 二、启动后端

```bash
cd /path/to/base_agent_game
conda activate feiyi_game
python -m uvicorn app.main:app --port 8000 --reload
```

后端启动后会：
- 初始化 SQLite 数据库（`storage/feiyi.db`）
- 创建 Chroma 向量库目录（`storage/chroma`）
-挂载静态图片目录（`storage/images`）
- 加载事件模板（`data/events/*.json`）

确认启动成功：

```bash
curl http://localhost:8000/health
# {"status":"ok","version":"0.1.0"}
```

---

## 三、启动前端

```bash
cd frontend
npm install   # 首次运行需要，之后可跳过
npm run dev
```

前端 Dev Server 启动后访问：**http://localhost:5173**

Vite 会自动代理 `/api` `/static` `/health` 到后端 `localhost:8000`。

---

## 四、功能验证

### 4.1 师傅 NPC 对话（子目标 1）

1. 启动前后端
2. 进入游戏地图，走近阿婆或老爷爷
3. 按 **E** 键触发对话
4.确认对话框显示 AI生成的个性化回复

**手动验证 API：**

```bash
curl -X POST http://localhost:8000/api/v1/master/chat \
  -H "Content-Type: application/json" \
  -d '{
    "player_state": {
      "player_id": "test",
      "current_stage": "task",
      "learner_level": "beginner",
      "selected_materials": {},
      "parameters": {
        "fabric_type": "white_silk",
        "shuliang_concentration": 0.5,
        "dye_cycles": 6,
        "dye_water_temp": 25,
        "sun_hours": 6,
        "sun_total_days": 3,
        "wu_mud_thickness": 0.5,
        "wu_duration_minutes": 30,
        "wu_apply_count": 1,
        "wash_water_temp": 20,
        "air_dry_hours": 8
      },
      "history": []
    },
    "npc_id": "granny",
    "message": "师傅你好"
  }'
```

配置真实 API Key 后返回示例：
```json
{
  "master_reply": "「阿婆：后生仔，学香云纱急不得，慢慢来。」",
  "risk_tags": [],
  "hint_type": "silent",
  ...
}
```

---

### 4.2 AI 随机事件（子目标 2）

**手动验证 API：**

```bash
# 标记游戏开始（建立时间基准）
curl -X POST http://localhost:8000/api/v1/events/game/start

# 检查事件（触发雨天事件）
curl -X POST http://localhost:8000/api/v1/events/check \
  -H "Content-Type: application/json" \
  -d '{
    "player_state": {
      "player_id": "test",
      "current_stage": "task",
      "learner_level": "beginner",
      "selected_materials": {},
      "parameters": {
        "fabric_type": "white_silk","shuliang_concentration": 0.5,
        "dye_cycles": 6,"dye_water_temp": 25,"sun_hours": 6,
        "sun_total_days": 3,"wu_mud_thickness": 0.5,
        "wu_duration_minutes": 30,"wu_apply_count": 1,
        "wash_water_temp": 20,"air_dry_hours": 8
      },
      "history": []
    },
    "current_weather": "rainy",
    "quest_step": -1,
    "arrived_location": null
  }'
```

返回示例（雨天天气触发了阿花事件）：
```json
{
  "fired": true,
  "pending_events": [{
    "event_id": "evt_ahua_rainy_warning",
    "npc_id": "ahua",
    "location": "village",
    "messages": [
      "阿花：哎呀，下雨天路滑，你去青翠山采薯莨要小心啊！",
      "阿花：我这里有把旧伞，你要不要借去？"
    ]
  }],
  "event_messages": [...]
}
```

**查看待处理事件：**
```bash
curl http://localhost:8000/api/v1/events/pending
```

**忽略事件：**
```bash
curl -X POST http://localhost:8000/api/v1/events/<event_id>/dismiss \
  -H "Content-Type: application/json" -d '{}'
```

---

## 五、事件触发条件一览

| 事件 ID | 触发类型 | 条件 | NPC |
|---|---|---|---|
| `evt_ahua_rainy_warning` | 天气变化 | `weather=rainy` | 阿花 |
| `evt_ahua_storm_warning` | 天气变化 | `weather=cloudy` | 阿花 |
| `evt_yeye_sunny_tip` | 天气变化 | `weather=sunny` | 老爷爷 |
| `evt_granny_encourage` | 时间触发 | 游戏开始 ≥10 分钟 | 阿婆 |
| `evt_craft_wu_too_long` | 工艺风险 | `risk_tag=wu_too_long` 出现 ≥2 次 | 老爷爷 |
| `evt_craft_sun_insufficient` | 工艺风险 | `risk_tag=sun_insufficient` 出现 ≥2 次 | 阿婆 |
| `evt_craft_dye_insufficient` | 工艺风险 | `risk_tag=dye_insufficient` 出现 ≥2 次 | 老爷爷 |
| `evt_quest_mountain_arrival` | 任务进度 | 到达 mountain 场景 | 阿花 |
| `evt_quest_village_arrival` | 任务进度 | 到达 village 场景 | 阿婆 |

> **cooldown：** 同一事件触发后 30 分钟内不会重复触发

---

## 六、API 端口配置说明

如果后端需要用非8000 端口启动，需同步修改前端代理配置：

**文件：** `frontend/vite.config.ts`

```typescript
proxy: {
  '/api': 'http://localhost:<你的端口>',
  '/static': 'http://localhost:<你的端口>',
  '/health': 'http://localhost:<你的端口>',
}
```

---

## 七、文件结构一览

```
base_agent_game/
├── app/
│   ├── agent/
│   │   ├── master_agent.py # AI Agent（含 generate_event）
│   │   ├── prompts.py # 所有 system prompt + NPC_PERSONAS
│   │   └── tool_registry.py    # LLM 工具注册
│   ├── api/routes/
│   │   ├── events.py           # 事件 API（check/pending/dismiss）
│   │   ├── master.py           # 师傅对话 API
│   │   ├── artwork.py          # 生图 API
│   │   └── scoring.py          # 评分 API
│   ├── data/
│   │   ├── schemas.py          # 所有数据模型（含 GameEvent）
│   │   └── rules.py           # 工艺规则引擎
│   ├── services/
│   │   └── event_scheduler.py  # 事件调度器（备用）
│   └── main.py                 # FastAPI 入口
├── data/events/
│   ├── weather_warning.json    # 天气相关事件
│   ├── craft_risks.json       # 工艺风险事件
│   └── quest_events.json       # 任务进度事件
├── frontend/src/
│   ├── app/
│   │   ├── App.tsx             # 根组件（含 EventToast）
│   │   ├── GameState.tsx       # 游戏状态（含事件轮询）
│   │   └── nav.ts              # 场景路由
│   ├── scenes/
│   │   ├── MapScene.tsx        # 地图（含 NPC AI 对话触发）
│   │   └── EventScene.tsx      # 事件场景
│   └── components/
│       ├── NpcDialogue.tsx     # NPC 对话框（含 loading 状态）
│       └── EventToast.tsx       # 事件通知 Toast
├── plan.md                     # 完整实施方案
└── RUN_GUIDE.md # 本文档
```

---

## 八、常见问题

**Q：NPC 对话按 E 没反应**
- 确认后端在运行：`curl http://localhost:8000/health`
- 确认 `.env` 填了 `DASHSCOPE_API_KEY`（无 key 时走 fallback 逻辑，但 API 应正常返回）

**Q：事件 Toast 没有出现**
- 刷新页面（前端每 30s 轮询一次）
- 检查浏览器控制台有没有 API错误
- 确认天气已切换到触发条件的天气（雨天触发雨天事件）

**Q：TypeScript 报错**
- 前端：`cd frontend && npm run typecheck` 定位具体文件
- 后端：`python -m py_compile app/<filename>` 定位具体文件

**Q：端口被占用**
- `netstat -ano | grep :8000` 查看占用进程
- `taskkill /PID <pid> /F` 结束进程后重开
- 或改用其他端口并同步修改 `vite.config.ts`