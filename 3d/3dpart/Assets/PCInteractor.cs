using System.Collections;
using UnityEngine;
using TMPro;

public class PCInteractor : MonoBehaviour
{
    enum ParameterPanelKind { None, DyeVat, Drying, Wu, Wash }

    private static readonly float[] DyeTempOptions = { 10f, 25f, 35f, 55f };
    private static readonly float[] DyeConcentrationOptions = { 0.2f, 0.5f, 0.8f };
    private static readonly float[] SunHourOptions = { 1f, 3f, 6f, 8f };
    private static readonly float[] WuDurationOptions = { 20f, 60f, 90f, 130f };
    private static readonly float[] WuThicknessOptions = { 0.2f, 0.5f, 0.7f, 0.9f };
    private static readonly float[] WashTempOptions = { 15f, 25f, 40f };

    [Header("引用设置")]
    public Transform holdPosition;
    public float interactDistance = 15f;

    [Header("UI提示设置")]
    public GameObject hoverPromptObj;
    private TextMeshProUGUI promptText;

    [Header("动画设置")]
    public float flySpeed = 8f;

    private PickableItem heldItem = null;
    private Camera myCam;
    private bool isAnimating = false;

    private PickableItem targetItem = null;
    private DropZone targetZone = null;
    private Coroutine activeFlyCoroutine = null;
    private PCMovement movement;

    private bool parameterPanelOpen = false;
    private ParameterPanelKind activePanelKind = ParameterPanelKind.None;
    private int activeParamRow = 0;
    private int dyeTempIndex = 1;
    private int dyeConcentrationIndex = 1;
    private int sunHourIndex = 2;
    private int wuDurationIndex = 1;
    private int wuThicknessIndex = 1;
    private int washTempIndex = 1;
    private static Texture2D overlayGuiTexture;
    private static Texture2D panelGuiTexture;
    private static Texture2D borderGuiTexture;

    void Start()
    {
        myCam = GetComponent<Camera>();
        movement = GetComponent<PCMovement>();
        SyncOptionIndicesFromCurrentValues();
        if (hoverPromptObj != null)
        {
            promptText = hoverPromptObj.GetComponent<TextMeshProUGUI>();
            hoverPromptObj.SetActive(false);
        }
    }

    void Update()
    {
        if (parameterPanelOpen)
        {
            HandleParameterPanelInput();
            return;
        }

        if (Input.GetKeyDown(KeyCode.Q))
        {
            if (heldItem != null) { TryReturnItem(heldItem); return; }
            else if (targetItem != null && targetItem.currentZone != null) { TryReturnItem(targetItem); return; }
        }

        if (isAnimating) return;
        DetectObjectInFront();

        if (Input.GetKeyDown(KeyCode.R))
        {
            ParameterPanelKind context = GetParameterPanelKind();
            if (context != ParameterPanelKind.None)
            {
                OpenParameterPanel(context);
                return;
            }
        }

        if (Input.GetKeyDown(KeyCode.E))
        {
            if (heldItem == null && targetItem != null) TryPickup();
            else if (heldItem != null)
            {
                // ==========================================
                // ⚠️ 刷子执行逻辑：绝对精准打击
                // ==========================================
                if (heldItem.itemID == "Brush")
                {
                    if (targetItem != null && targetItem.itemID == "Board")
                    {
                        BrushData brushData = heldItem.GetComponent<BrushData>();
                        StencilData stencilData = targetItem.GetComponent<StencilData>();
                        if (brushData != null && brushData.isMuddy && stencilData != null && !stencilData.isMudded)
                        {
                            stencilData.ApplyMudChunk();
                            if (stencilData.isMudded) brushData.ConsumeMud();
                            return;
                        }
                    }
                    else if (targetZone != null)
                    {
                        string zoneName = targetZone.gameObject.name.ToLower();
                        if (zoneName.Contains("mud") || zoneName.Contains("泥"))
                        {
                            BrushData brushData = heldItem.GetComponent<BrushData>();
                            if (brushData != null)
                            {
                                if (!brushData.isMuddy)
                                {
                                    if (activeFlyCoroutine != null) StopCoroutine(activeFlyCoroutine);
                                    activeFlyCoroutine = StartCoroutine(DipBrushRoutine(heldItem, targetZone.transform, brushData));
                                }
                                else brushData.DipInMud();
                            }
                            return;
                        }
                    }
                }
                else if (targetZone != null && CheckStrictPlacement(heldItem, targetZone))
                {
                    TryPlaceItem();
                }
            }
        }
    }

    bool CheckStrictPlacement(PickableItem item, DropZone zone)
    {
        string zName = zone.gameObject.name.ToLower();

        // 桌子无条件放行（展示成品用）
        if (zName.Contains("centercloth") || zName.Contains("board") || zName.Contains("table") || zName.Contains("desk")) return true;

        // 【试错学习模式】只做物理校验（类型/占用/依赖，见 DropZone.CanAccept），
        // 不再按香云纱工艺顺序拦截 —— 顺序对错交由师傅在放置后点评
        // （见 ClothData.OnPlacedInZone：做对推进工艺，做错不推进、师傅纠正）。
        return zone.CanAccept(item);
    }

    void DetectObjectInFront()
    {
        bool isTableOccupied = false;
        DropZone[] allZones = FindObjectsOfType<DropZone>();
        foreach (DropZone zone in allZones)
        {
            if (zone.currentlyPlacedItem != null) { isTableOccupied = true; break; }
        }

        Ray ray = myCam.ViewportPointToRay(new Vector3(0.5f, 0.5f, 0));
        RaycastHit hit;
        bool foundInteraction = false;

        targetItem = null;
        targetZone = null;

        if (Physics.Raycast(ray, out hit, interactDistance))
        {
            DropZone hitZone = hit.collider.GetComponent<DropZone>();
            PickableItem hitItem = hit.collider.GetComponentInParent<PickableItem>();

            if (hitItem != null && hitZone == null && hitItem.currentZone != null) hitZone = hitItem.currentZone;
            else if (hitItem == null && hitZone != null && hitZone.currentlyPlacedItem != null) hitItem = hitZone.currentlyPlacedItem;

            // ⚠️ 终极修复：只有当玩家空手时，才允许穿透卡槽拿布料！拿着刷子绝对不穿透！
            if (heldItem == null && hitItem == null && hitZone != null && hitZone.gameObject.name.ToLower().Contains("board"))
            {
                GameObject clothZoneObj = GameObject.Find("DropZone_CenterCloth");
                if (clothZoneObj != null)
                {
                    DropZone clothZone = clothZoneObj.GetComponent<DropZone>();
                    if (clothZone != null && clothZone.currentlyPlacedItem != null)
                    {
                        hitItem = clothZone.currentlyPlacedItem;
                        hitZone = clothZone;
                    }
                }
            }

            targetZone = hitZone;
            targetItem = hitItem;

            if (heldItem == null)
            {
                if (targetItem != null)
                {
                    bool isBusyDrying = false;
                    if (targetItem.itemID == "SilkCloth")
                    {
                        ClothData clothData = targetItem.GetComponent<ClothData>();
                        if (clothData != null && clothData.isDrying) isBusyDrying = true;
                    }

                    if (isBusyDrying)
                    {
                        targetItem = null;
                        foundInteraction = true;
                        if (promptText != null) promptText.text = "[ 晾晒中... ]";
                    }
                    else
                    {
                        if (isTableOccupied && targetItem.currentZone != null)
                        {
                            foundInteraction = true;
                            if (promptText != null) promptText.text = "[ E ] 拿取 / [ Q ] 退回";
                        }
                        else
                        {
                            foundInteraction = true;
                            if (promptText != null) promptText.text = "[ E ] 拿取";
                        }
                    }
                }
            }
            else
            {
                // ==========================================
                // ✅ 已修复：刷子UI逻辑（涂抹优先级 > 蘸泥）
                // ==========================================
                if (heldItem.itemID == "Brush")
                {
                    bool isAimingAtBoard = false;

                    // 1. 优先检测印花板（最高优先级）
                    if (targetItem != null && targetItem.itemID == "Board")
                    {
                        BrushData brushData = heldItem.GetComponent<BrushData>();
                        StencilData stencilData = targetItem.GetComponent<StencilData>();
                        if (brushData != null && stencilData != null)
                        {
                            isAimingAtBoard = true;
                            foundInteraction = true;

                            if (!brushData.isMuddy)
                            {
                                if (promptText != null) promptText.text = "[ 刷子太干，请先蘸泥 ]";
                            }
                            else if (!stencilData.isMudded)
                            {
                                if (promptText != null) promptText.text = $"[ E ] 涂抹黑泥 ({stencilData.mudCoatCount}/4)";
                            }
                            else
                            {
                                if (promptText != null) promptText.text = "[ 印花板已涂满 ]";
                            }
                        }
                    }

                    // 2. 只有没对准印花板时，才检测 mud
                    if (!isAimingAtBoard && targetZone != null)
                    {
                        string zName = targetZone.gameObject.name.ToLower();
                        if (zName == "mud")
                        {
                            foundInteraction = true;
                            if (promptText != null) promptText.text = "[ E ] 蘸取河泥";
                        }
                    }
                }
                else // 拿着布或者板子
                {
                    // 只有拿放置类物品时才允许寻路兄弟卡槽
                    if (targetZone != null && !targetZone.CanAccept(heldItem))
                    {
                        DropZone[] siblings = targetZone.transform.parent != null ? targetZone.transform.parent.GetComponentsInChildren<DropZone>() : targetZone.GetComponentsInChildren<DropZone>();
                        foreach (var z in siblings) { if (z.CanAccept(heldItem)) { targetZone = z; break; } }
                    }

                    if (targetZone != null && CheckStrictPlacement(heldItem, targetZone))
                    {
                        foundInteraction = true;
                        string zName = targetZone.gameObject.name.ToLower();
                        if (heldItem.itemID == "SilkCloth" && (zName.Contains("water") || zName.Contains("river") || zName.Contains("wash") || zName.Contains("水") || zName.Contains("河") || zName.Contains("洗")))
                        {
                            if (promptText != null) promptText.text = "[ E ] 洗去浮泥";
                        }
                        else
                        {
                            if (promptText != null) promptText.text = "[ E ] 放置";
                        }
                    }
                }
            }
        }
        else { targetItem = null; targetZone = null; }

        if (hoverPromptObj != null)
        {
            if (!foundInteraction && GetParameterPanelKind() != ParameterPanelKind.None && promptText != null)
            {
                foundInteraction = true;
                promptText.text = "[ R ] 参数";
            }
            else if (foundInteraction) AppendParameterHint();
            if (foundInteraction && !hoverPromptObj.activeSelf) hoverPromptObj.SetActive(true);
            else if (!foundInteraction && hoverPromptObj.activeSelf) hoverPromptObj.SetActive(false);
        }
    }

    void TryPickup()
    {
        if (targetItem.itemID == "Board")
        {
            StencilData stencilData = targetItem.GetComponent<StencilData>();
            if (stencilData != null && stencilData.isMudded)
            {
                GameObject clothZoneObj = GameObject.Find("DropZone_CenterCloth");
                if (clothZoneObj != null)
                {
                    DropZone clothZone = clothZoneObj.GetComponent<DropZone>();
                    if (clothZone != null && clothZone.currentlyPlacedItem != null)
                    {
                        ClothData clothData = clothZone.currentlyPlacedItem.GetComponent<ClothData>();
                        if (clothData != null) clothData.ApplyMudPattern(stencilData.patternType);
                    }
                }
            }
        }

        // 起手引导：拿起全新白坯绸时，师傅给个开场提示（仅全新布触发，避免刷屏）
        if (targetItem.itemID == "SilkCloth")
        {
            ClothData cd = targetItem.GetComponent<ClothData>();
            if (cd != null && cd.dyeLoopCount == 0 && !cd.isWet && !cd.hasMudPattern)
            {
                WorkshopBridge.SendAsk("师父，我拿起了这块白坯绸，第一步该怎么做？");
            }
        }

        heldItem = targetItem;
        if (heldItem.currentZone != null)
        {
            heldItem.currentZone.currentlyPlacedItem = null;
            heldItem.currentZone = null;
        }
        Rigidbody rb = heldItem.GetComponent<Rigidbody>();
        if (rb != null) rb.isKinematic = true;
        Collider col = heldItem.GetComponent<Collider>();
        if (col != null) col.enabled = false;
        heldItem.transform.SetParent(holdPosition);

        if (hoverPromptObj != null) hoverPromptObj.SetActive(false);

        DropZone[] allZones = FindObjectsOfType<DropZone>();
        foreach (DropZone zone in allZones)
        {
            if (CheckStrictPlacement(heldItem, zone)) zone.ToggleVisual(true);
        }
        if (activeFlyCoroutine != null) StopCoroutine(activeFlyCoroutine);
        activeFlyCoroutine = StartCoroutine(FlyAnimation(heldItem.transform, heldItem.holdOffset, Quaternion.Euler(heldItem.holdRotation), heldItem.heldScale, true));
    }

    void TryPlaceItem()
    {
        Collider col = heldItem.GetComponent<Collider>();
        if (col != null) col.enabled = true;
        heldItem.transform.SetParent(null);
        Transform destTransform = targetZone.placeTarget != null ? targetZone.placeTarget : targetZone.transform;

        targetZone.currentlyPlacedItem = heldItem;
        heldItem.currentZone = targetZone;

        DropZone[] allZones = FindObjectsOfType<DropZone>();
        foreach (DropZone zone in allZones) zone.ToggleVisual(false);

        if (activeFlyCoroutine != null) StopCoroutine(activeFlyCoroutine);
        activeFlyCoroutine = StartCoroutine(FlyAnimation(heldItem.transform, destTransform.position, destTransform.rotation, heldItem.originalScale, false));

        if (heldItem.itemID == "SilkCloth")
        {
            heldItem.gameObject.SendMessage("OnPlacedInZone", targetZone, SendMessageOptions.DontRequireReceiver);
            targetZone.gameObject.SendMessage("OnClothPlaced", heldItem.gameObject, SendMessageOptions.DontRequireReceiver);
            targetZone.gameObject.SendMessage("StartDyeingProcess", heldItem.gameObject, SendMessageOptions.DontRequireReceiver);
        }

        heldItem = null;
        targetItem = null;
        targetZone = null;
    }

    void TryReturnItem(PickableItem itemToReturn)
    {
        if (itemToReturn == null) return;
        if (activeFlyCoroutine != null) StopCoroutine(activeFlyCoroutine);
        isAnimating = false;
        if (itemToReturn.currentZone != null)
        {
            itemToReturn.currentZone.currentlyPlacedItem = null;
            itemToReturn.currentZone.ToggleVisual(false);
            itemToReturn.currentZone = null;
        }
        Collider col = itemToReturn.GetComponent<Collider>();
        if (col != null) col.enabled = true;
        Rigidbody rb = itemToReturn.GetComponent<Rigidbody>();
        if (rb != null) rb.isKinematic = true;
        itemToReturn.transform.SetParent(null);
        activeFlyCoroutine = StartCoroutine(FlyAnimation(itemToReturn.transform, itemToReturn.spawnWorldPos, itemToReturn.spawnWorldRot, itemToReturn.originalScale, false));
        if (itemToReturn == heldItem) heldItem = null;
        targetItem = null;
        targetZone = null;
        if (hoverPromptObj != null) hoverPromptObj.SetActive(false);
    }

    IEnumerator FlyAnimation(Transform objToMove, Vector3 targetPos, Quaternion targetRot, Vector3 targetScale, bool isLocalSpace)
    {
        isAnimating = true;
        Vector3 startPos = isLocalSpace ? objToMove.localPosition : objToMove.position;
        Quaternion startRot = isLocalSpace ? objToMove.localRotation : objToMove.rotation;
        Vector3 startScale = objToMove.localScale;
        float progress = 0f;
        while (progress < 1f)
        {
            progress += Time.deltaTime * flySpeed;
            if (isLocalSpace)
            {
                objToMove.localPosition = Vector3.Lerp(startPos, targetPos, progress);
                objToMove.localRotation = Quaternion.Lerp(startRot, targetRot, progress);
            }
            else
            {
                objToMove.position = Vector3.Lerp(startPos, targetPos, progress);
                objToMove.rotation = Quaternion.Lerp(startRot, targetRot, progress);
            }
            objToMove.localScale = Vector3.Lerp(startScale, targetScale, progress);
            yield return null;
        }
        if (isLocalSpace) { objToMove.localPosition = targetPos; objToMove.localRotation = targetRot; }
        else { objToMove.position = targetPos; objToMove.rotation = targetRot; }
        objToMove.localScale = targetScale;
        isAnimating = false;
    }

    ParameterPanelKind GetParameterPanelKind()
    {
        if (targetZone != null)
        {
            string zName = targetZone.gameObject.name.ToLower();
            if (IsVatZone(zName)) return ParameterPanelKind.DyeVat;
            if (IsDryZone(zName)) return ParameterPanelKind.Drying;
            if (IsWashZone(zName)) return ParameterPanelKind.Wash;
            if (IsMudZone(zName)) return ParameterPanelKind.Wu;
        }

        if (heldItem != null && heldItem.itemID == "Brush" && targetItem != null && targetItem.itemID == "Board")
        {
            return ParameterPanelKind.Wu;
        }

        return ParameterPanelKind.None;
    }

    bool IsVatZone(string zName)
    {
        return zName.Contains("vat") || zName.Contains("缸") || zName.Contains("染");
    }

    bool IsDryZone(string zName)
    {
        return zName.Contains("slot") || zName.Contains("meadow") || zName.Contains("dry") || zName.Contains("草地") || zName.Contains("晒");
    }

    bool IsWashZone(string zName)
    {
        return zName.Contains("water") || zName.Contains("river") || zName.Contains("wash") || zName.Contains("水") || zName.Contains("河") || zName.Contains("洗");
    }

    bool IsMudZone(string zName)
    {
        return zName.Contains("mud") || zName.Contains("泥") || zName.Contains("wu") || zName.Contains("过乌");
    }

    void AppendParameterHint()
    {
        if (promptText == null) return;
        if (GetParameterPanelKind() == ParameterPanelKind.None) return;
        if (promptText.text.Contains("[ R ]")) return;
        promptText.text += " / [ R ] 参数";
    }

    void OpenParameterPanel(ParameterPanelKind kind)
    {
        // 改为「网页浮层面板」：不再用 Unity OnGUI（WebGL 下鼠标/键盘交互不可靠）。
        // 松开鼠标（looking=false 同时也会冻住移动/视角），并通知前端弹出可点的参数面板。
        // 玩家选完后点击 3D 画面即自动重新锁定回第一人称。
        if (movement != null) movement.ReleaseLook();
        WorkshopBridge.SendOp("{\"type\":\"open_params\",\"kind\":\"" + PanelKindKey(kind) + "\"}");
        if (hoverPromptObj != null) hoverPromptObj.SetActive(false);
    }

    string PanelKindKey(ParameterPanelKind kind)
    {
        if (kind == ParameterPanelKind.DyeVat) return "DyeVat";
        if (kind == ParameterPanelKind.Drying) return "Drying";
        if (kind == ParameterPanelKind.Wu) return "Wu";
        if (kind == ParameterPanelKind.Wash) return "Wash";
        return "None";
    }

    void CloseParameterPanel()
    {
        parameterPanelOpen = false;
        activePanelKind = ParameterPanelKind.None;
        if (movement != null) movement.canMove = true;
        // 重新锁定鼠标，回到第一人称
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
    }

    void OnDisable()
    {
        if (movement != null) movement.canMove = true;
    }

    void HandleParameterPanelInput()
    {
        if (Input.GetKeyDown(KeyCode.R) || Input.GetKeyDown(KeyCode.Escape))
        {
            CloseParameterPanel();
            return;
        }

        int rowCount = GetPanelRowCount(activePanelKind);
        if (Input.GetKeyDown(KeyCode.UpArrow)) activeParamRow = Wrap(activeParamRow - 1, rowCount);
        if (Input.GetKeyDown(KeyCode.DownArrow)) activeParamRow = Wrap(activeParamRow + 1, rowCount);

        if (Input.GetKeyDown(KeyCode.LeftArrow)) AdjustCurrentOption(-1);
        if (Input.GetKeyDown(KeyCode.RightArrow)) AdjustCurrentOption(1);

        if (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter) || Input.GetKeyDown(KeyCode.E))
        {
            ApplyParameterPanel();
            CloseParameterPanel();
        }
    }

    int GetPanelRowCount(ParameterPanelKind kind)
    {
        if (kind == ParameterPanelKind.DyeVat) return 2;
        if (kind == ParameterPanelKind.Wu) return 2;
        return 1;
    }

    void AdjustCurrentOption(int delta)
    {
        if (activePanelKind == ParameterPanelKind.DyeVat)
        {
            if (activeParamRow == 0) dyeTempIndex = Wrap(dyeTempIndex + delta, DyeTempOptions.Length);
            else dyeConcentrationIndex = Wrap(dyeConcentrationIndex + delta, DyeConcentrationOptions.Length);
        }
        else if (activePanelKind == ParameterPanelKind.Drying)
        {
            sunHourIndex = Wrap(sunHourIndex + delta, SunHourOptions.Length);
        }
        else if (activePanelKind == ParameterPanelKind.Wu)
        {
            if (activeParamRow == 0) wuDurationIndex = Wrap(wuDurationIndex + delta, WuDurationOptions.Length);
            else wuThicknessIndex = Wrap(wuThicknessIndex + delta, WuThicknessOptions.Length);
        }
        else if (activePanelKind == ParameterPanelKind.Wash)
        {
            washTempIndex = Wrap(washTempIndex + delta, WashTempOptions.Length);
        }
    }

    void ApplyParameterPanel()
    {
        if (activePanelKind == ParameterPanelKind.DyeVat)
        {
            WorkshopCraftParameters.DyeWaterTemp = DyeTempOptions[dyeTempIndex];
            WorkshopCraftParameters.ShuliangConcentration = DyeConcentrationOptions[dyeConcentrationIndex];
            WorkshopCraftParameters.ReportDyeSettings();
            Debug.Log($"<color=cyan>【染缸参数】水温 {WorkshopCraftParameters.DyeWaterTemp}°C，薯莨浓度 {WorkshopCraftParameters.ShuliangConcentration}</color>");
        }
        else if (activePanelKind == ParameterPanelKind.Drying)
        {
            WorkshopCraftParameters.SunHours = SunHourOptions[sunHourIndex];
            WorkshopCraftParameters.ReportDrySelection();
            Debug.Log($"<color=yellow>【晾晒参数】单次晾晒 {WorkshopCraftParameters.SunHours} 小时</color>");
        }
        else if (activePanelKind == ParameterPanelKind.Wu)
        {
            WorkshopCraftParameters.WuDurationMinutes = WuDurationOptions[wuDurationIndex];
            WorkshopCraftParameters.WuMudThickness = WuThicknessOptions[wuThicknessIndex];
            WorkshopCraftParameters.ReportWuSettings();
            Debug.Log($"<color=magenta>【过乌参数】等待 {WorkshopCraftParameters.WuDurationMinutes} 分钟，泥厚 {WorkshopCraftParameters.WuMudThickness}</color>");
        }
        else if (activePanelKind == ParameterPanelKind.Wash)
        {
            WorkshopCraftParameters.WashWaterTemp = WashTempOptions[washTempIndex];
            WorkshopCraftParameters.ReportWashSettings();
            Debug.Log($"<color=cyan>【水洗参数】水温 {WorkshopCraftParameters.WashWaterTemp}°C</color>");
        }
    }

    void SyncOptionIndicesFromCurrentValues()
    {
        dyeTempIndex = NearestIndex(DyeTempOptions, WorkshopCraftParameters.DyeWaterTemp);
        dyeConcentrationIndex = NearestIndex(DyeConcentrationOptions, WorkshopCraftParameters.ShuliangConcentration);
        sunHourIndex = NearestIndex(SunHourOptions, WorkshopCraftParameters.SunHours);
        wuDurationIndex = NearestIndex(WuDurationOptions, WorkshopCraftParameters.WuDurationMinutes);
        wuThicknessIndex = NearestIndex(WuThicknessOptions, WorkshopCraftParameters.WuMudThickness);
        washTempIndex = NearestIndex(WashTempOptions, WorkshopCraftParameters.WashWaterTemp);
    }

    int NearestIndex(float[] values, float current)
    {
        int best = 0;
        float bestDelta = Mathf.Abs(values[0] - current);
        for (int i = 1; i < values.Length; i++)
        {
            float d = Mathf.Abs(values[i] - current);
            if (d < bestDelta)
            {
                best = i;
                bestDelta = d;
            }
        }
        return best;
    }

    int Wrap(int value, int count)
    {
        if (count <= 0) return 0;
        while (value < 0) value += count;
        while (value >= count) value -= count;
        return value;
    }

    string PanelTitle(ParameterPanelKind kind)
    {
        if (kind == ParameterPanelKind.DyeVat) return "染缸参数";
        if (kind == ParameterPanelKind.Drying) return "晾晒参数";
        if (kind == ParameterPanelKind.Wu) return "过乌参数";
        if (kind == ParameterPanelKind.Wash) return "水洗参数";
        return "工艺参数";
    }

    void OnGUI()
    {
        if (!parameterPanelOpen) return;

        GUI.depth = -1000;
        float scale = Mathf.Clamp(Screen.height / 720f, 1.25f, 3.2f);

        GUIStyle titleStyle = new GUIStyle(GUI.skin.label);
        titleStyle.fontSize = Mathf.RoundToInt(34f * scale);
        titleStyle.fontStyle = FontStyle.Bold;
        titleStyle.normal.textColor = Color.white;

        GUIStyle optionStyle = new GUIStyle(GUI.skin.label);
        optionStyle.fontSize = Mathf.RoundToInt(30f * scale);
        optionStyle.normal.textColor = new Color(1f, 0.94f, 0.82f);

        GUIStyle selectedStyle = new GUIStyle(optionStyle);
        selectedStyle.fontStyle = FontStyle.Bold;
        selectedStyle.normal.textColor = new Color(1f, 0.82f, 0.35f);

        GUIStyle hintStyle = new GUIStyle(GUI.skin.label);
        hintStyle.fontSize = Mathf.RoundToInt(22f * scale);
        hintStyle.normal.textColor = new Color(0.96f, 0.88f, 0.72f);

        float panelWidth = Mathf.Min(880f * scale, Screen.width - 48f * scale);
        float panelHeight = GetPanelRowCount(activePanelKind) > 1 ? 330f * scale : 290f * scale;
        if (panelWidth < 520f) panelWidth = Mathf.Max(320f, Screen.width - 24f);
        float panelX = (Screen.width - panelWidth) * 0.5f;
        float panelY = (Screen.height - panelHeight) * 0.5f;
        float border = Mathf.Max(4f, 4f * scale);

        DrawSolidRect(new Rect(0, 0, Screen.width, Screen.height), new Color(0f, 0f, 0f, 0.82f), ref overlayGuiTexture);
        DrawSolidRect(new Rect(panelX, panelY, panelWidth, panelHeight), new Color(0.08f, 0.045f, 0.02f, 1f), ref panelGuiTexture);
        DrawSolidRect(new Rect(panelX, panelY, panelWidth, border), new Color(0.95f, 0.65f, 0.28f, 1f), ref borderGuiTexture);
        DrawSolidRect(new Rect(panelX, panelY + panelHeight - border, panelWidth, border), new Color(0.95f, 0.65f, 0.28f, 1f), ref borderGuiTexture);
        DrawSolidRect(new Rect(panelX, panelY, border, panelHeight), new Color(0.95f, 0.65f, 0.28f, 1f), ref borderGuiTexture);
        DrawSolidRect(new Rect(panelX + panelWidth - border, panelY, border, panelHeight), new Color(0.95f, 0.65f, 0.28f, 1f), ref borderGuiTexture);

        GUILayout.BeginArea(new Rect(panelX + 34f * scale, panelY + 28f * scale, panelWidth - 68f * scale, panelHeight - 56f * scale));
        GUILayout.Label("工艺参数 - " + PanelTitle(activePanelKind), titleStyle, GUILayout.Height(46f * scale));
        GUILayout.Space(12f * scale);

        if (activePanelKind == ParameterPanelKind.DyeVat)
        {
            DrawOptionLine(0, "染液水温", DyeTempOptions[dyeTempIndex].ToString("0") + " °C", optionStyle, selectedStyle);
            DrawOptionLine(1, "薯莨浓度", DyeConcentrationOptions[dyeConcentrationIndex].ToString("0.0"), optionStyle, selectedStyle);
        }
        else if (activePanelKind == ParameterPanelKind.Drying)
        {
            DrawOptionLine(0, "单次晾晒", SunHourOptions[sunHourIndex].ToString("0") + " 小时", optionStyle, selectedStyle);
        }
        else if (activePanelKind == ParameterPanelKind.Wu)
        {
            DrawOptionLine(0, "过乌等待", WuDurationOptions[wuDurationIndex].ToString("0") + " 分钟", optionStyle, selectedStyle);
            DrawOptionLine(1, "泥浆厚度", WuThicknessOptions[wuThicknessIndex].ToString("0.0"), optionStyle, selectedStyle);
        }
        else if (activePanelKind == ParameterPanelKind.Wash)
        {
            DrawOptionLine(0, "水洗水温", WashTempOptions[washTempIndex].ToString("0") + " °C", optionStyle, selectedStyle);
        }

        GUILayout.Space(18f * scale);
        GUILayout.Label("↑↓ 切换参数    ←→ 调整数值    Enter/E 应用    R/Esc 关闭", hintStyle, GUILayout.Height(34f * scale));
        GUILayout.EndArea();
    }

    void DrawOptionLine(int row, string label, string value, GUIStyle optionStyle, GUIStyle selectedStyle)
    {
        string prefix = activeParamRow == row ? "> " : "  ";
        GUILayout.Label(prefix + label + "： " + value, activeParamRow == row ? selectedStyle : optionStyle, GUILayout.Height((activeParamRow == row ? selectedStyle : optionStyle).fontSize + 16f));
    }

    void DrawSolidRect(Rect rect, Color color, ref Texture2D texture)
    {
        if (texture == null)
        {
            texture = new Texture2D(1, 1, TextureFormat.RGBA32, false);
            texture.hideFlags = HideFlags.HideAndDontSave;
            texture.SetPixel(0, 0, color);
            texture.Apply();
        }

        GUI.DrawTexture(rect, texture);
    }

    IEnumerator DipBrushRoutine(PickableItem brush, Transform mudBowl, BrushData brushData)
    {
        isAnimating = true;
        if (hoverPromptObj != null) hoverPromptObj.SetActive(false);

        brush.transform.SetParent(null);
        Vector3 startPos = brush.transform.position;
        Quaternion startRot = brush.transform.rotation;
        Vector3 startScale = brush.transform.localScale;
        Vector3 targetPos = mudBowl.position + new Vector3(0, 8.5f, 0);
        Quaternion targetRot = Quaternion.Euler(-90, 0, 0);
        Vector3 targetScale = brush.originalScale;
        float dipSpeed = flySpeed * 0.6f;

        float progress = 0f;
        while (progress < 1f)
        {
            progress += Time.deltaTime * dipSpeed;
            brush.transform.position = Vector3.Lerp(startPos, targetPos, progress);
            brush.transform.rotation = Quaternion.Lerp(startRot, targetRot, progress);
            brush.transform.localScale = Vector3.Lerp(startScale, targetScale, progress);
            yield return null;
        }

        brush.transform.position = targetPos;
        brush.transform.rotation = targetRot;
        brush.transform.localScale = targetScale;

        brushData.DipInMud();
        yield return new WaitForSeconds(0.6f);

        brush.transform.SetParent(holdPosition);
        startPos = brush.transform.localPosition;
        startRot = brush.transform.localRotation;
        startScale = brush.transform.localScale;
        Vector3 handTargetPos = brush.holdOffset;
        Quaternion handTargetRot = Quaternion.Euler(brush.holdRotation);
        Vector3 handTargetScale = brush.heldScale;

        progress = 0f;
        while (progress < 1f)
        {
            progress += Time.deltaTime * dipSpeed;
            brush.transform.localPosition = Vector3.Lerp(startPos, handTargetPos, progress);
            brush.transform.localRotation = Quaternion.Lerp(startRot, handTargetRot, progress);
            brush.transform.localScale = Vector3.Lerp(startScale, handTargetScale, progress);
            yield return null;
        }

        brush.transform.localPosition = handTargetPos;
        brush.transform.localRotation = handTargetRot;
        brush.transform.localScale = handTargetScale;
        isAnimating = false;
    }
}
