using UnityEngine;

public class PickableItem : MonoBehaviour
{
    [Header("物品属性")]
    public string itemID = "Board";

    [Header("手持姿态设置")]
    public Vector3 holdOffset = new Vector3(0, 0, 0);
    public Vector3 holdRotation = new Vector3(60, -30, 0);
    public Vector3 heldScale = new Vector3(14f, 15f, 14f);

    [HideInInspector] public Vector3 originalScale;

    // 【核心新增】：记录开局时在各自架子/卡槽里的绝对世界坐标和旋转，供 Q 键无脑退回
    [HideInInspector] public Vector3 spawnWorldPos;
    [HideInInspector] public Quaternion spawnWorldRot;

    // 【核心新增】：记录当前正躺在哪个放置区，方便被重新拿走时释放格子
    [HideInInspector] public DropZone currentZone = null;

    void Start()
    {
        originalScale = transform.localScale;

        // 游戏一运行，立刻把各自现在的出生点死死记住
        spawnWorldPos = transform.position;
        spawnWorldRot = transform.rotation;
    }
}