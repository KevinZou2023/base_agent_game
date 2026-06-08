using UnityEngine;

public class LiquidFlow : MonoBehaviour
{
    public float normalSpeedX = 0.04f;
    public float normalSpeedY = 0.02f;
    public float rotateSpeed = 1.5f;

    private Renderer rend;
    private Material mat;

    void Start()
    {
        rend = GetComponent<Renderer>();
        mat = rend.material;
    }

    void Update()
    {
        // 推动水波法线贴图，让液面看起来在流动
        Vector2 offset = new Vector2(Time.time * normalSpeedX, Time.time * normalSpeedY);
        mat.SetTextureOffset("_BumpMap", offset);

        // 轻微旋转液面，增加染缸里液体缓慢晃动的感觉
        transform.Rotate(0f, rotateSpeed * Time.deltaTime, 0f);
    }
}