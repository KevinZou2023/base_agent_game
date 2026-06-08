using UnityEngine;

[RequireComponent(typeof(PickableItem))]
public class ClothPhysicsHandler : MonoBehaviour
{
    private Cloth clothComponent;
    private bool isCurrentlyHeld = false;
    private PickableItem itemInfo;

    void Start()
    {
        clothComponent = GetComponent<Cloth>();
        itemInfo = GetComponent<PickableItem>();
        
        if (clothComponent != null) clothComponent.enabled = false;
    }

    void Update()
    {
        bool isHeldNow = (transform.parent != null);

        if (isHeldNow && !isCurrentlyHeld)
        {
            // 【被抓在手里】：开启物理，清空碰撞体（防止拿在手里时和桌子乱卡）
            if (clothComponent != null)
            {
                clothComponent.enabled = true;
                clothComponent.capsuleColliders = new CapsuleCollider[0]; 
                clothComponent.ClearTransformMotion(); 
            }
            isCurrentlyHeld = true;
        }
        else if (!isHeldNow && isCurrentlyHeld)
        {
            // 【被放下或退回】：判断此时身处何方
            if (clothComponent != null)
            {
                if (itemInfo.currentZone != null && itemInfo.currentZone.keepClothPhysics)
                {
                    // 放在了染缸里：保持物理开启，塞入染缸的碰撞体让其堆叠
                    clothComponent.enabled = true;
                    clothComponent.capsuleColliders = itemInfo.currentZone.clothColliders;
                }
                else
                {
                    // 放在了桌面上：关闭物理，恢复完美平铺
                    clothComponent.enabled = false;
                    clothComponent.capsuleColliders = new CapsuleCollider[0];
                }
            }
            isCurrentlyHeld = false;
        }
    }
}