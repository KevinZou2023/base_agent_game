using UnityEngine;

public class DropZone : MonoBehaviour
{
    [Header("放置验证")]
    public string acceptedItemID = "Board";
    public Transform placeTarget;

    [Header("依赖设置 (极其高级的功能)")]
    [Tooltip("如果你希望这个卡槽必须等底下的卡槽放了东西才能用（比如板子必须等布放好），就把底下的 DropZone 拖到这里")]
    public DropZone requiredBaseZone;

    [Header("视觉提示设置")]
    public GameObject placementVisual;

    [Header("布料物理 (仅染缸等需要褶皱的区域使用)")]
    public bool keepClothPhysics = false;
    public CapsuleCollider[] clothColliders;

    [HideInInspector] public PickableItem currentlyPlacedItem = null;

    void Start()
    {
        if (placementVisual != null)
            placementVisual.SetActive(false);
    }

    public bool CanAccept(PickableItem incomingItem)
    {
        if (incomingItem == null) return false;

        // ==========================================
        // ⚠️【核心拦截 1】：图层依赖锁
        // 如果设置了 requiredBaseZone，且里面没放东西，这个卡槽直接闭门谢客！
        // ==========================================
        if (requiredBaseZone != null && requiredBaseZone.currentlyPlacedItem == null) return false;

        // 基础校验（物理层面，保留）：类型必须匹配、卡槽不能已被占用
        if (incomingItem.itemID != acceptedItemID) return false;
        if (currentlyPlacedItem != null) return false;

        // ==========================================
        // 【试错学习模式】不再按香云纱工艺顺序拦截布料 ——
        // 任何类型匹配的卡槽都接受放置，顺序对错交由师傅在放置后点评
        // （见 ClothData.OnPlacedInZone：做对推进工艺，做错不推进、师傅纠正）。
        // 原先这里会按 vat 顺序 / 是否晒干 / 是否染满四遍 做硬拦截，现已移除。
        // ==========================================

        return true;
    }

    public void ToggleVisual(bool show)
    {
        if (currentlyPlacedItem != null && show) return;
        if (placementVisual != null) placementVisual.SetActive(show);
    }
}