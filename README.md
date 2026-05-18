# 艺镜工坊 · 香云纱后端 (feiyi-game-backend)

非遗香云纱 AI Agent 教学与作品生成后端。基于 FastAPI + DashScope (Qwen + 通义万相) + ChromaDB + SQLite。

## 总体架构

```
轻量 2D 村落 (Unity 前端)
        ↓ HTTP
   FastAPI 网关 (本项目)
        ├── 师傅 Agent (Qwen + Tools)
        ├── 知识检索 (ChromaDB + DashScope embedding)
        ├── 规则引擎 (Python rules.py)
        ├── AI 生图 (通义万相)
        └── 评分 + 用户状态 (SQLite)
```

## 快速开始

```bash
# 1. 创建 conda 环境
conda create -n feiyi_game python=3.11 -y
conda activate feiyi_game

# 2. 安装依赖
pip install -e ".[dev]"

# 3. 配置密钥
cp .env.example .env
# 编辑 .env 填入真实的 DASHSCOPE_API_KEY

# 4. 灌入香云纱知识库
python scripts/seed_data.py

# 5. 启动服务
uvicorn app.main:app --reload
# 浏览器打开 http://localhost:8000/docs
```

## 项目结构

- `app/agent/` — 师傅 Agent 核心循环、Prompt 模板、LLM 抽象层
- `app/tools/` — 11 个工具（知识检索、规则校验、教学策略、Prompt 生成、生图、评分等）
- `app/data/` — Pydantic schemas + 香云纱工艺规则矩阵
- `app/storage/` — ChromaDB / SQLite / 文件存储封装
- `app/api/routes/` — 4 个 HTTP 接口（master / artwork / scoring / user_state）
- `data/processed/` — 4 个清洗后的香云纱知识 JSON 文件
- `scripts/` — `seed_data.py`（灌库）、`smoke_test.py`（全链路冒烟）

## 核心接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/v1/master/chat` | 师傅 Agent 对话 |
| POST | `/api/v1/artwork/generate` | 触发 AI 贴图生成 |
| GET | `/api/v1/scoring/{artwork_id}` | 多维评分 + 师傅点评 |
| GET / PUT | `/api/v1/user/{player_id}/state` | 玩家进度同步 |
| GET | `/static/images/{filename}` | 生成图静态资源 |

## 开发周期

4 周（2026-05-18 → 2026-06-14），按周交付：

- Week 1：数据库（ChromaDB + SQLite + 规则）
- Week 2：Agent 核心循环
- Week 3：FastAPI 网关 + AI 生图
- Week 4：联调、评分完善、交付

详细计划见 [docs/plan.md](docs/plan.md)。
