# 3D 工坊（Unity WebGL）—— 应用实际读取的目录

前端 `WorkshopScene.tsx` 的 `UNITY_INDEX` 指向本目录（`3d-ui-new/index.html`）。
进入「织布坊」时加载这里的 Unity 工坊；若不存在则回退到内置 R3F 占位染坊。

## 每次重新导出 Unity 后（必做）

1. Unity 里 Build WebGL（Compression Format = **Disabled**），导出到 `3d/3dpart/3d_ui_new`。
2. 把导出的 `index.html` + `Build/` + `TemplateData/` **覆盖**进本目录（`frontend/public/3d-ui-new/`）。
3. **改缓存版本号**（关键！构建文件名跨次导出不变，不改版本号浏览器会继续用缓存的旧 `.data`）：
   编辑本目录 `index.html` 里的 `var V = "?v=...";`，把版本号改成新值（如日期+字母）。
4. 浏览器刷新页面即可（`WorkshopScene.tsx` 已给 index.html 自带整页级缓存绕过）。

> 画面铺满 iframe 的 CSS 由 React 在 onLoad 注入，所以可直接放原始 Unity 导出，无需手改 index.html 的 canvas 尺寸。

## Unity↔前端 桥接 / 师傅旁观点评

桥接脚本在 `3d/3dpart/Assets/`：`WorkshopBridge.cs`（静态 API）+ `Plugins/WorkshopBridge.jslib`。
工艺脚本（ClothData/StencilData）已在工序节点调用 `WorkshopBridge.SendParam(...)`/`SendAsk(...)`
上报操作；前端 `MasterBubble` 监听 `workshop:op`/`workshop:ask` → 调 `/master/chat` → 师傅气泡。
要让师傅说针对性的话，需开后端：`uvicorn app.main:app --host 127.0.0.1 --port 8000`（conda 环境 `feiyi_game`）。
