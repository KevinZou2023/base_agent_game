using System.Globalization;
using UnityEngine;
#if UNITY_WEBGL && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

/// <summary>
/// 香云纱 3D 工坊 ↔ 2D 前端 桥接。
///
/// 【静态上报 API】任何脚本都能直接调，无需在场景里挂物体：
///   · WorkshopBridge.SendParam("dye_cycles", n)  上报工艺参数 → 师傅旁观点评
///   · WorkshopBridge.SendEvent("submit")          上报一个事件（如成品完成）
///   · WorkshopBridge.SendAsk("师父，这样对吗？")   主动向师傅提问
///
/// 【实例方法】给 UI 按钮 OnClick 用（可选）：场景里挂个空物体拖上本脚本，
///   把按钮指到 Finish()（→成品展示）/ Leave()（→返回地图）。
///   Ready() 在 Start() 自动调一次（通知前端工坊已加载）。
///
/// 最终都调用 Assets/Plugins/WorkshopBridge.jslib 里的同名函数向外层网页
/// postMessage；前端 WorkshopScene.tsx 已在监听。编辑器/非 WebGL 下只打日志、不报错。
///
/// 后端 operation_perception 认得的参数名：
///   dye_cycles 浸染次数 / dye_water_temp 染液水温 / sun_hours 单次日晒 /
///   sun_total_days 累计晒莨 / wu_mud_thickness 过乌泥厚 /
///   wu_duration_minutes 过乌时间 / wu_apply_count 过乌涂抹次数
/// </summary>
public class WorkshopBridge : MonoBehaviour
{
#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")] private static extern void WorkshopFinish();
    [DllImport("__Internal")] private static extern void WorkshopLeave();
    [DllImport("__Internal")] private static extern void WorkshopReady();
    [DllImport("__Internal")] private static extern void WorkshopOperation(string json);
    [DllImport("__Internal")] private static extern void WorkshopAsk(string message);
#endif

    // ───────────── 静态上报 API（工艺脚本调这些）─────────────

    /// <summary>上报一个工艺参数变化（如 SendParam("dye_cycles", 3)）→ 师傅点评。</summary>
    public static void SendParam(string paramName, float value)
    {
        // 用不变文化格式化，避免某些 locale 把小数点写成逗号导致 JSON 非法
        string v = value.ToString(System.Globalization.CultureInfo.InvariantCulture);
        SendOp("{\"type\":\"param_change\",\"changes\":{\"" + paramName + "\":" + v + "}}");
    }

    /// <summary>上报一个事件类型（如 "submit" 表示成品完成）。</summary>
    public static void SendEvent(string eventType)
    {
        SendOp("{\"type\":\"" + eventType + "\"}");
    }

    /// <summary>上报任意操作事件（完全自定义 JSON）。</summary>
    public static void SendOp(string json)
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        WorkshopOperation(json);
#else
        Debug.Log("[WorkshopBridge] op → " + json);
#endif
    }

    /// <summary>主动向师傅提问（自由文本）。</summary>
    public static void SendAsk(string message)
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        WorkshopAsk(message);
#else
        Debug.Log("[WorkshopBridge] ask → " + message);
#endif
    }

    // ───────────── 实例方法（UI 按钮 OnClick 用，可选）─────────────

    /// <summary>「完成制作」按钮：前端走成品评分 + 3D 成品展示。</summary>
    public void Finish()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        WorkshopFinish();
#else
        Debug.Log("[WorkshopBridge] Finish() —— WebGL 构建后会通知前端跳转成品展示");
#endif
    }

    /// <summary>「离开工坊」按钮：前端返回 2D 大地图。</summary>
    public void Leave()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        WorkshopLeave();
#else
        Debug.Log("[WorkshopBridge] Leave() —— WebGL 构建后会通知前端返回地图");
#endif
    }

    /// <summary>通知前端工坊已就绪（Start 时自动调用一次）。</summary>
    public void Ready()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        WorkshopReady();
#else
        Debug.Log("[WorkshopBridge] Ready() —— WebGL 构建后会通知前端工坊已加载");
#endif
    }

    // 兼容旧写法：实例方法转调静态
    public void ReportParam(string paramName, float value) => SendParam(paramName, value);
    public void ReportOperation(string eventJson) => SendOp(eventJson);
    public void Ask(string message) => SendAsk(message);

    private void Start()
    {
        Ready();
    }
}

/// <summary>
/// Runtime craft parameter state shared by the 3D workshop scripts.
/// The values are the craft semantics reported to the React/FastAPI master;
/// realtime waits are scaled down so the WebGL workshop stays playable.
/// </summary>
public static class WorkshopCraftParameters
{
    public static float DyeWaterTemp = 25f;
    public static float ShuliangConcentration = 0.5f;
    public static float SunHours = 6f;
    public static int SunTotalDays = 0;
    public static float WuDurationMinutes = 60f;
    public static float WuMudThickness = 0.5f;
    public static float WashWaterTemp = 25f;

    public static float DryRealtimeSeconds
    {
        get { return Mathf.Clamp(SunHours * 0.75f, 1.5f, 8f); }
    }

    public static float WuRealtimeSeconds
    {
        get { return Mathf.Clamp(WuDurationMinutes / 30f, 1f, 6f); }
    }

    public static void ReportDyeSettings()
    {
        SendParamChange(
            "\"dye_water_temp\":" + F(DyeWaterTemp) +
            ",\"shuliang_concentration\":" + F(ShuliangConcentration)
        );
    }

    public static void ReportDrySelection()
    {
        SendParamChange("\"sun_hours\":" + F(SunHours));
    }

    public static void RecordDryingComplete()
    {
        SunTotalDays = Mathf.Max(0, SunTotalDays) + 1;
        SendParamChange(
            "\"sun_hours\":" + F(SunHours) +
            ",\"sun_total_days\":" + SunTotalDays.ToString(CultureInfo.InvariantCulture)
        );
    }

    public static void ReportWuSettings()
    {
        SendParamChange(
            "\"wu_duration_minutes\":" + F(WuDurationMinutes) +
            ",\"wu_mud_thickness\":" + F(WuMudThickness)
        );
    }

    public static void ReportWashSettings()
    {
        SendParamChange("\"wash_water_temp\":" + F(WashWaterTemp));
    }

    private static string F(float value)
    {
        return value.ToString("0.###", CultureInfo.InvariantCulture);
    }

    private static void SendParamChange(string changesJson)
    {
        WorkshopBridge.SendOp("{\"type\":\"param_change\",\"changes\":{" + changesJson + "}}");
    }
}
