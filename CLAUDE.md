# 计划：时间系统 + 天气随机变化

---

## Context

当前时间和天气的现状：
- **时间**：完全没有时间推进，TopStatusBar 显示固定时间 11:20，没有日/夜循环
- **天气**：完全由玩家手动切换（按钮 cycle: map → mapCloudy → mapRainy），无随机性、无惯性
- **影响范围**：天气只影响晒莨场景（雨天阻止晒莨），其他工艺场景完全忽略天气

目标：
1. 实时时钟与真实时间同步，显示在界面上
2. 天气带惯性随机变化（晴→多云→雨→晴），不是纯随机也不是纯顺序
3. 天气影响扩展到所有工艺场景（采料质量、浸染效果、过乌效果）

---

## Part1：时间系统

### 实现

#### 1. GameState.tsx — 新增 gameTime state

```typescript
const [gameTime, setGameTime] = useState<Date>(() => new Date())

// 每60 秒更新一次真实时间（只在地图场景时更新）
useEffect(() => {
  if (!['map', 'mapCloudy', 'mapRainy'].includes(scene)) return
  const interval = setInterval(() => setGameTime(new Date()), 60_000)
  return () => clearInterval(interval)
}, [scene])
```

#### 2. TopStatusBar.tsx — 驱动实时显示

```typescript
// 从 props.gameTime 读取，格式化为 HH:mm
// 显示十二时辰：子丑寅卯辰巳午未申酉戌亥
// 每 2 小时 = 一个时辰（游戏内1 天 = 12 时辰）
const SHICHEN = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
const shichen = SHICHEN[Math.floor(gameTime.getHours() / 2) % 12]
const timeStr = `${String(gameTime.getHours()).padStart(2,'0')}:${String(gameTime.getMinutes()).padStart(2,'0')}`
```

#### 3. Context暴露

```typescript
gameTime: Date
```

---

## Part2：天气惯性随机系统

### 天气状态机

```
晴天(sunny) --30%--> 多云(cloudy)
                --10%--> 雨天(rainy)
多云(cloudy) --40%--> 晴天(sunny)
                --30%--> 雨天(rainy)
雨天(rainy)  --50%--> 多云(cloudy)
                --15%--> 晴天(sunny)
```

每次检查（每 N 分钟）根据当前天气按概率转移。

### 实现

#### 1. GameState.tsx — 新增 weatherTransition

```typescript
const WEATHER_PROBS: Record<Weather, { sunny: number; cloudy: number; rainy: number }> = {
  sunny:  { sunny: 0.60, cloudy: 0.30, rainy: 0.10 },
  cloudy: { sunny: 0.40, cloudy: 0.30, rainy: 0.30 },
  rainy:  { sunny: 0.15, cloudy: 0.50, rainy: 0.35 },
}

function nextWeather(current: Weather): Weather {
  const probs = WEATHER_PROBS[current]
  const r = Math.random()
  let acc = 0
  for (const [w, p] of Object.entries(probs) as [Weather, number][]) {
    acc += p
    if (r < acc) return w
  }
  return current
}
```

#### 2. 天气轮询（每 3 分钟自动变化）

```typescript
useEffect(() => {
  if (!['map', 'mapCloudy', 'mapRainy'].includes(scene)) return
  const interval = setInterval(() => {
    const next = nextWeather(weather)
    if (next !== weather) {
      setWeather(next)
      // 更新地图场景
      const sceneMap: Record<Weather, SceneId> = {
        sunny: 'map', cloudy: 'mapCloudy', rainy: 'mapRainy'
      }
      go(sceneMap[next])
    }
  }, 180_000) //3 分钟检查一次
  return () => clearInterval(interval)
}, [weather, scene])
```

#### 3. 移除手动天气切换按钮逻辑（可选保留）

为保留兼容性，保留按钮但改为"随机切换"触发一次变化。

---

## Part3：天气影响扩展到所有工艺场景

### 影响规则

| 场景 | 晴天(sunny) | 多云(cloudy) | 雨天(rainy) |
|------|------------|------------|------------|
| MountainScene（采薯莨） |浓度+10% | 正常 | 浓度-15%，提示"雨天采的薯莨偏湿" |
| DyeWaitScene（浸染） | 上色匀透，火候提示正面 | 正常 | 提示"雨天湿度大，浸染效果略差" |
| DryingScene（晒莨） |正常（已有） | 慢，火候难掌（已有） | 完全阻止（已有） |
| RiverScene（过乌） | 正常 | 正常 | 提示"雨天河水泥稀，过乌效果下降" |

### 实现

每个场景的 `masterLine` 判断逻辑加上 `weather` 条件：

```typescript
// MountainScene.tsx
const masterLine = weather === 'rainy'
  ? '雨天采的薯莨偏湿，浓度会低些，浸染时多浸两道。'
  : weather === 'sunny'
  ? '薯莨饱满，汁色定然浓亮，下缸去罢。'
  : concentration >= 0.8 ? '薯莨饱满…' : '薯莨偏嫩…'
```

---

## 关键文件

| 文件 | 改动 |
|------|------|
| `frontend/src/app/GameState.tsx` | 新增 `gameTime` state + `nextWeather` 转移函数 + 天气轮询 effect |
| `frontend/src/components/TopStatusBar.tsx` | 从 `gameTime` prop 实时显示 HH:mm + 十二时辰 |
| `frontend/src/scenes/MountainScene.tsx` | 天气影响 masterLine + 浓度参数 |
| `frontend/src/scenes/DyeWaitScene.tsx` | 天气影响 hint提示 |
| `frontend/src/scenes/RiverScene.tsx` | 天气影响 masterLine + 提示 |
| `frontend/src/scenes/DryingScene.tsx` | 已有逻辑保留，微调提示文字 |
| `frontend/src/app/nav.ts` | `GameContextValue` 新增 `gameTime: Date` |

---

## 验证方式

1. 重启前端，观察右上角时钟是否与真实时间同步
2. 在地图停留 3 分钟以上，观察天气是否自动变化（不按按钮）
3. 连续晴天多次，确认天气逐渐向雨天迁移（惯性）
4. 进入各工艺场景，确认天气提示随当前天气变化
5. 雨天进晒莨场景，确认阻止交互逻辑正常