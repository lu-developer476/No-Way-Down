using UnityEngine;
namespace NWD.Player {
public sealed class FirstPersonLook : MonoBehaviour {
  [SerializeField]
  Transform body;
  [SerializeField]
  float sensitivity = .1f;
  [SerializeField] bool invertVertical;
  [SerializeField, Range(45, 100)] float verticalLimit = 85;
  float pitch;
  public void Look(Vector2 delta) {
    if (!body)
      return;
    body.Rotate(Vector3.up * delta.x * sensitivity);
    pitch = Mathf.Clamp(pitch + delta.y * sensitivity * (invertVertical ? 1 : -1),
                        -verticalLimit, verticalLimit);
    transform.localRotation = Quaternion.Euler(pitch, 0, 0);
  }
  void OnEnable() { Cursor.lockState = CursorLockMode.Locked; Cursor.visible = false; }
  void OnDisable() { Cursor.lockState = CursorLockMode.None; Cursor.visible = true; }
}
}
