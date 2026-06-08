using UnityEngine;

[RequireComponent(typeof(PickableItem))]
public class BrushData : MonoBehaviour
{
    [Header("毛刷状态")]
    public bool isMuddy = false; // 当前是否沾满黑泥

    [Header("美术资产引用")]
    [Tooltip("因为你的刷毛分成了多个部件，请在这里填入部件数量，并把它们统统拖进来")]
    public Renderer[] brushHairRenderers; // 【核心升级】：改成数组模式

    [Tooltip("干净的毛刷材质")]
    public Material dryMaterial;
    [Tooltip("沾满黑泥的毛刷材质")]
    public Material muddyMaterial;

    // 蘸取河泥的方法
    public void DipInMud()
    {
        if (!isMuddy)
        {
            isMuddy = true;
            if (muddyMaterial != null && brushHairRenderers != null)
            {
                // 遍历数组里所有的刷毛部件，让它们全部变黑！
                foreach (Renderer r in brushHairRenderers)
                {
                    if (r != null) r.material = muddyMaterial;
                }
            }
            Debug.Log("<color=cyan>【过乌工艺】毛刷已蘸满黑泥！可以去给印花板涂泥了。</color>");
        }
        else
        {
            Debug.Log("<color=orange>【提示】毛刷上已经有泥了，不用重复蘸取。</color>");
        }
    }

    // 预留接口：涂完泥后，消耗掉泥巴变回干净刷子
    public void ConsumeMud()
    {
        isMuddy = false;
        if (dryMaterial != null && brushHairRenderers != null)
        {
            // 洗刷子时，全部恢复原样
            foreach (Renderer r in brushHairRenderers)
            {
                if (r != null) r.material = dryMaterial;
            }
        }
    }
}