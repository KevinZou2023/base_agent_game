using UnityEngine;

public class PCMovement : MonoBehaviour
{
    [Header("移动设置")]
    public float moveSpeed = 5f;
    public bool canMove = true;

    [Header("视角设置")]
    [Tooltip("鼠标转视角灵敏度，数值越小越稳。WebGL 指针锁定下 1~3 比较合适；场景里两个角色已设为 2。")]
    public float mouseSensitivity = 2f;

    private float xRotation = 0f;
    private bool looking = true; // 鼠标当前是否锁定用于转视角

    void Start()
    {
        // 进入工坊先锁定鼠标转视角
        SetLooking(true);
    }

    void Update()
    {
        // 被外部禁用时（如参数面板打开）完全不处理输入，由对方独占鼠标/键盘，避免打架
        if (!canMove) return;

        // 按 ESC 松开鼠标 —— 这样在网页里能点到外层 UI（如「离开工坊」按钮）
        if (Input.GetKeyDown(KeyCode.Escape))
        {
            SetLooking(false);
        }
        // 鼠标松开后，点击画面重新进入转视角
        if (!looking && Input.GetMouseButtonDown(0))
        {
            SetLooking(true);
        }

        if (!looking) return;

        // 视角：实时跟随鼠标移动（无需按住任何按键）
        float mouseX = Input.GetAxisRaw("Mouse X") * mouseSensitivity;
        float mouseY = Input.GetAxisRaw("Mouse Y") * mouseSensitivity;

        xRotation -= mouseY;
        xRotation = Mathf.Clamp(xRotation, -90f, 90f);

        transform.localRotation = Quaternion.Euler(xRotation, transform.localEulerAngles.y, 0f);
        transform.Rotate(Vector3.up * mouseX, Space.World);

        // WASD 移动
        float horizontal = Input.GetAxisRaw("Horizontal");
        float vertical = Input.GetAxisRaw("Vertical");

        Vector3 moveDirection = transform.right * horizontal + transform.forward * vertical;
        moveDirection.y = 0;

        transform.position += moveDirection.normalized * moveSpeed * Time.deltaTime;
    }

    // 切换鼠标锁定状态
    private void SetLooking(bool on)
    {
        looking = on;
        Cursor.lockState = on ? CursorLockMode.Locked : CursorLockMode.None;
        Cursor.visible = !on;
    }

    /// <summary>给外部（如打开网页参数面板时）调用：松开鼠标、退出转视角。
    /// 之后玩家点击 3D 画面会自动重新锁定（见 Update 里的点击重锁逻辑）。</summary>
    public void ReleaseLook()
    {
        SetLooking(false);
    }
}
