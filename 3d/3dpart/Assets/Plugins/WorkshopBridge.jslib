// 香云纱 3D 工坊 ↔ 2D 前端 桥接
//
// 这些函数被 WorkshopBridge.cs 通过 [DllImport("__Internal")] 调用，
// 作用是向「包住本 Unity 画布的外层网页」(React/Vite 的 iframe 父窗口) 发消息。
// 前端 WorkshopScene.tsx 已经在监听这些消息：
//   workshop:finish → 触发成品评分并跳转 3D 成品展示
//   workshop:leave  → 返回 2D 大地图
//   workshop:ready  → (可选) 通知前端工坊已加载完成
//
// 兼容性：用 parent ?? window，这样无论是被 iframe 嵌入还是单独打开都不报错。
mergeInto(LibraryManager.library, {
  // 完成制作 —— 把按钮的 OnClick 接到 WorkshopBridge.Finish()
  WorkshopFinish: function () {
    var target = window.parent || window;
    target.postMessage({ type: 'workshop:finish' }, '*');
  },

  // 离开工坊 —— 接到 WorkshopBridge.Leave()
  WorkshopLeave: function () {
    var target = window.parent || window;
    target.postMessage({ type: 'workshop:leave' }, '*');
  },

  // 工坊就绪 —— 接到 WorkshopBridge.Ready()，可在 Start() 里调用
  WorkshopReady: function () {
    var target = window.parent || window;
    target.postMessage({ type: 'workshop:ready' }, '*');
  },

  // 上报一次操作事件 —— 师傅会旁观点评。
  // 传入 JSON 字符串，如 {"type":"param_change","changes":{"wu_duration_minutes":130}}
  WorkshopOperation: function (jsonPtr) {
    var json = UTF8ToString(jsonPtr);
    var target = window.parent || window;
    var payload;
    try { payload = JSON.parse(json); }
    catch (e) { payload = { type: 'raw', raw: json }; }
    target.postMessage({ type: 'workshop:op', event: payload }, '*');
  },

  // 主动向师傅提问（自由文本）—— 接到 WorkshopBridge.Ask()
  WorkshopAsk: function (msgPtr) {
    var msg = UTF8ToString(msgPtr);
    var target = window.parent || window;
    target.postMessage({ type: 'workshop:ask', message: msg }, '*');
  },
});
