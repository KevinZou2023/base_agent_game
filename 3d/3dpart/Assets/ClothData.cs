using System.Collections;
using UnityEngine;

[RequireComponent(typeof(PickableItem))]
public class ClothData : MonoBehaviour
{
    [Header("布料独立状态 (运行时自动变化)")]
    public int dyeLoopCount = 0;
    public bool isWet = false;
    [HideInInspector] public bool isDrying = false;
    [HideInInspector] public bool isWuWaiting = false;
    [HideInInspector] public bool wuWaitComplete = false;
    private Coroutine activeWuCoroutine;

    // ==========================================
    // ⚠️【新增】：过乌泥巴状态记录
    // ==========================================
    [Header("新增：过乌泥巴状态")]
    public bool hasMudPattern = false; // 是否正裹着泥巴没洗
    public StencilData.PatternType currentPattern;

    [Header("美术资产引用")]
    public Material[] dyedMaterials;
    public Renderer clothRenderer;

    [Header("过乌过渡材质配置 (洗河泥前)")]
    public Material matMuddyCloud;
    public Material matMuddyBamboo;
    public Material matMuddyMountain;
    public Material matMuddyFloral;
    public Material matMuddyGeometric;

    [Header("过乌成品材质配置 (洗河泥后)")]
    public Material matFinishedCloud;
    public Material matFinishedBamboo;
    public Material matFinishedMountain;
    public Material matFinishedFloral;
    public Material matFinishedGeometric;

    public void OnPlacedInZone(DropZone zone)
    {
        if (zone == null) return;

        string rawZoneName = zone.gameObject.name.ToLower();
        string cleanZoneName = rawZoneName.Replace(" ", "").Replace("_", "");

        // ==========================================
        // 判定三：扔进了河水清洗区
        // ==========================================
        if (cleanZoneName.Contains("water") || cleanZoneName.Contains("river") || cleanZoneName.Contains("wash") || rawZoneName.Contains("水") || rawZoneName.Contains("河") || rawZoneName.Contains("洗"))
        {
            if (hasMudPattern)
            {
                if (isWuWaiting && !wuWaitComplete)
                {
                    WorkshopBridge.SendAsk($"师父，过乌还没等够。我设的是 {WorkshopCraftParameters.WuDurationMinutes} 分钟，现在就洗会不会黑亮面反应不充分？");
                    return;
                }

                Debug.Log($"<color=cyan>【洗河泥】布料在河水中洗去浮泥，显现最终纹样！</color>");
                WorkshopCraftParameters.ReportWashSettings();
                ApplyFinishedPattern(currentPattern);
                hasMudPattern = false; // 洗干净了
                isWuWaiting = false;
                wuWaitComplete = false;
                isWet = true; // 洗完是湿的，可拿去最后晾干
                WorkshopBridge.SendEvent("submit"); // 成品诞生 → 师傅总评
            }
            else
            {
                WorkshopBridge.SendAsk("师父，我把布拿到河里洗，可它还没过乌、没裹泥呢，这步是不是早了？"); // 试错：过早洗
            }
            return; // 洗泥巴直接返回，不走下面的染缸逻辑
        }

        // ==========================================
        // 判定一：扔进了染缸
        // ==========================================
        if (cleanZoneName.Contains("vat"))
        {
            // 试错：已过乌裹泥 / 已染满四遍，还来下缸 —— 不推进，师傅纠正
            if (hasMudPattern)
            {
                WorkshopBridge.SendAsk("师父，这布已经过乌裹着泥了，怎么还能再下染缸呢？");
                return;
            }
            if (dyeLoopCount >= 4)
            {
                WorkshopBridge.SendAsk("师父，这布已经浸染四遍了，是不是该去过乌、不该再下缸了？");
                return;
            }

            string expectedVat = "vat" + (dyeLoopCount + 1);

            if (cleanZoneName.Contains(expectedVat))
            {
                if (!isWet)
                {
                    isWet = true;
                    Debug.Log($"<color=cyan>【操作正确】布料进入 {expectedVat}，第 {dyeLoopCount + 1} 次浸染成功！</color>");
                    WorkshopCraftParameters.ReportDyeSettings();
                    WorkshopBridge.SendParam("dye_cycles", dyeLoopCount + 1); // 上报浸染 → 师傅点评

                    if (dyedMaterials != null && dyeLoopCount < dyedMaterials.Length && clothRenderer != null)
                    {
                        clothRenderer.material = dyedMaterials[dyeLoopCount];
                    }
                }
                else
                {
                    Debug.LogWarning("<color=orange>【操作提示】布料还是湿的！不能连续染色，请先拿去草地晒干！</color>");
                    WorkshopBridge.SendAsk($"师父，这布还湿着就下缸，是不是该先拿去草地晒干，再染第 {dyeLoopCount + 1} 遍？"); // 试错：湿布连染
                }
            }
            else
            {
                Debug.LogWarning($"<color=red>【顺序错误】放错染缸了！这块布当前需要进行第 {dyeLoopCount + 1} 次浸染，你必须把它放进 {expectedVat} 里！</color>");
                WorkshopBridge.SendAsk($"师父，我好像放错染缸了。这块布现在该进行第 {dyeLoopCount + 1} 次浸染，对吗？"); // → 师傅纠正
            }
        }
        // ==========================================
        // 判定二：扔到了草地晒晾槽位 
        // ==========================================
        else if (cleanZoneName.Contains("slot") || cleanZoneName.Contains("meadow") || cleanZoneName.Contains("dry") || rawZoneName.Contains("草地"))
        {
            if (isWet && !isDrying)
            {
                StartCoroutine(DryCoroutine());
            }
            else if (!isWet)
            {
                WorkshopBridge.SendAsk("师父，这布是干的，还用得着拿去晒吗？"); // 试错：干布去晒
            }
        }
    }

    IEnumerator DryCoroutine()
    {
        isDrying = true;
        WorkshopCraftParameters.ReportDrySelection();
        Debug.Log($"<color=yellow>【布料 {gameObject.name}】平铺在草地上，按 {WorkshopCraftParameters.SunHours} 小时设定开始晾晒...</color>");

        yield return new WaitForSeconds(WorkshopCraftParameters.DryRealtimeSeconds);

        isWet = false;
        if (dyeLoopCount < 4) dyeLoopCount++; // 只有在前4次染色时才增加进度
        isDrying = false;
        WorkshopCraftParameters.RecordDryingComplete();

        Debug.Log($"<color=green>【布料 {gameObject.name}】晒干完成！当前进度：{dyeLoopCount}/4</color>");

        if (dyeLoopCount >= 4 && !hasMudPattern)
        {
            Debug.Log($"<color=gold>⭐⭐⭐ 已历经四蒸九煮，可以拿去涂泥了！⭐⭐⭐</color>");
        }
    }

    // ==========================================
    // ⚠️【新增】：板子拿走后，布料变成“泥巴厚涂”状态
    // ==========================================
    public void ApplyMudPattern(StencilData.PatternType pattern)
    {
        if (clothRenderer == null) return;

        // 试错：还没浸染满四遍就过乌 —— 照样让你做，但师傅提醒黑亮面起不来
        if (dyeLoopCount < 4)
        {
            WorkshopBridge.SendAsk($"师父，这布才浸染 {dyeLoopCount} 遍就过乌，底色还没上够，黑亮面起得来吗？");
        }

        hasMudPattern = true; // 挂上泥巴脏污标记
        currentPattern = pattern;
        isWuWaiting = true;
        wuWaitComplete = false;
        WorkshopCraftParameters.ReportWuSettings();

        Material targetMaterial = null;
        switch (pattern)
        {
            case StencilData.PatternType.Cloud: targetMaterial = matMuddyCloud; break;
            case StencilData.PatternType.Bamboo: targetMaterial = matMuddyBamboo; break;
            case StencilData.PatternType.Mountain: targetMaterial = matMuddyMountain; break;
            case StencilData.PatternType.Floral: targetMaterial = matMuddyFloral; break;
            case StencilData.PatternType.Geometric: targetMaterial = matMuddyGeometric; break;
        }

        if (targetMaterial != null)
        {
            clothRenderer.material = targetMaterial;
            Debug.Log($"<color=orange>【过乌开始】布料已附着 {pattern} 泥浆，等待 {WorkshopCraftParameters.WuDurationMinutes} 分钟后再洗泥。</color>");
            if (activeWuCoroutine != null) StopCoroutine(activeWuCoroutine);
            activeWuCoroutine = StartCoroutine(WuWaitCoroutine());
        }
    }

    IEnumerator WuWaitCoroutine()
    {
        yield return new WaitForSeconds(WorkshopCraftParameters.WuRealtimeSeconds);

        isWuWaiting = false;
        wuWaitComplete = true;
        WorkshopCraftParameters.ReportWuSettings();
        Debug.Log($"<color=magenta>【过乌等待完成】已按 {WorkshopCraftParameters.WuDurationMinutes} 分钟设定完成反应，可以拿去河边清洗。</color>");
        WorkshopBridge.SendAsk($"师父，我按设定等了 {WorkshopCraftParameters.WuDurationMinutes} 分钟，现在可以洗去河泥了吗？");
    }

    // 洗去浮泥后，蜕变为最终成品
    public void ApplyFinishedPattern(StencilData.PatternType pattern)
    {
        if (clothRenderer == null) return;

        Material targetMaterial = null;
        switch (pattern)
        {
            case StencilData.PatternType.Cloud: targetMaterial = matFinishedCloud; break;
            case StencilData.PatternType.Bamboo: targetMaterial = matFinishedBamboo; break;
            case StencilData.PatternType.Mountain: targetMaterial = matFinishedMountain; break;
            case StencilData.PatternType.Floral: targetMaterial = matFinishedFloral; break;
            case StencilData.PatternType.Geometric: targetMaterial = matFinishedGeometric; break;
        }

        if (targetMaterial != null)
        {
            clothRenderer.material = targetMaterial;
            Debug.Log($"<color=gold>【洗泥蜕变】浮泥洗去，{pattern} 纹样香云纱正式诞生！</color>");
        }
    }
}
