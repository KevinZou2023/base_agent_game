using UnityEngine;

public class PickUpObject : MonoBehaviour
{
    public Transform holdPosition;
    public float pickDistance = 10f;

    private GameObject heldObject;
    private Rigidbody heldRb;

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.E))
        {
            if (heldObject == null)
            {
                PickUp();
            }
        }

        if (Input.GetKeyDown(KeyCode.Q))
        {
            Drop();
        }
    }

    void PickUp()
    {
        Ray ray = new Ray(transform.position, transform.forward);

        Debug.DrawRay(transform.position, transform.forward * pickDistance, Color.red, 1f);

        if (Physics.Raycast(ray, out RaycastHit hit, pickDistance))
        {
            Debug.Log("Ray hit: " + hit.collider.name);

            Rigidbody rb = hit.collider.GetComponentInParent<Rigidbody>();

            if (rb == null)
            {
                Debug.Log("打到了物体，但是它或父物体没有 Rigidbody");
                return;
            }

            heldRb = rb;
            heldObject = rb.gameObject;

            heldRb.useGravity = false;
            heldRb.isKinematic = true;

            heldObject.transform.SetParent(holdPosition);
            heldObject.transform.localPosition = Vector3.zero;
            heldObject.transform.localRotation = Quaternion.identity;

            Debug.Log("Picked up: " + heldObject.name);
        }
        else
        {
            Debug.Log("没有打到任何物体");
        }
    }

    void Drop()
    {
        if (heldObject == null) return;

        heldObject.transform.SetParent(null);

        heldRb.isKinematic = false;
        heldRb.useGravity = true;

        Debug.Log("Dropped: " + heldObject.name);

        heldObject = null;
        heldRb = null;
    }
}