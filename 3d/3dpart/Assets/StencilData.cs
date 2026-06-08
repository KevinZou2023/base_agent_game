using System.Collections;
using UnityEngine;

[RequireComponent(typeof(PickableItem))]
public class StencilData : MonoBehaviour
{
    public enum PatternType { None, Cloud, Bamboo, Mountain, Floral, Geometric }

    [Header("印花属性")]
    public PatternType patternType;

    [Header("涂泥进度")]
    public int mudCoatCount = 0;
    public int maxCoatCount = 4;
    public bool isMudded = false;

    [Header("动画设置")]
    [Tooltip("刷单层横条泥巴时，从左到右完全展开的耗时（秒）")]
    public float smearDuration = 0.35f;

    [Header("横条泥巴设置 (必须严格按照【从上到下】的顺序拖入4个横条物体)")]
    [Tooltip("按从上到下的物理顺序，把那4道横向的泥巴物体依次拖进这里")]
    public GameObject[] mudRows = new GameObject[4];

    private Vector3[] originalScales = new Vector3[4];
    private Coroutine activeSmearRoutine;

    void Start()
    {
        // 初始化：记录4道横条的完整尺寸，开局时将它们的本地X轴缩放归零（隐藏）
        for (int i = 0; i < mudRows.Length; i++)
        {
            if (mudRows[i] != null)
            {
                originalScales[i] = mudRows[i].transform.localScale;
                // X轴代表左右长度，开局时长度为0
                mudRows[i].transform.localScale = new Vector3(0f, originalScales[i].y, originalScales[i].z);
                mudRows[i].SetActive(true);
            }
        }
    }

    public void ApplyMudChunk()
    {
        if (isMudded) return;

        // 当前应该刷哪一道横条（0代表最上面第一道，3代表最下面最后一道）
        int currentRowIndex = mudCoatCount;
        mudCoatCount++;
        WorkshopBridge.SendParam("wu_apply_count", mudCoatCount); // 上报过乌涂抹 → 师傅点评

        if (mudCoatCount >= maxCoatCount)
        {
            isMudded = true;
            Debug.Log($"<color=magenta>【过乌完成】{patternType} 印花板已被4道横向黑泥完全刷满！</color>");
        }

        // 播放当前这一行横条从左到右延伸的动效
        if (currentRowIndex < mudRows.Length && mudRows[currentRowIndex] != null)
        {
            if (activeSmearRoutine != null) StopCoroutine(activeSmearRoutine);
            activeSmearRoutine = StartCoroutine(SmoothRowGrow(currentRowIndex));
        }
    }

    // ==========================================
    // ⚠️【核心算法】：单行横条独立的“从左往右”平滑写“一”字
    // ==========================================
    IEnumerator SmoothRowGrow(int index)
    {
        GameObject row = mudRows[index];
        Vector3 targetScale = originalScales[index];
        Vector3 startScale = new Vector3(0f, targetScale.y, targetScale.z);

        float timeElapsed = 0f;
        while (timeElapsed < smearDuration)
        {
            timeElapsed += Time.deltaTime;
            float t = timeElapsed / smearDuration;

            // 仅仅让当前这一行在本地X轴（左右长度）上平滑拉长
            row.transform.localScale = Vector3.Lerp(startScale, targetScale, t);
            yield return null;
        }

        row.transform.localScale = targetScale;
    }
}