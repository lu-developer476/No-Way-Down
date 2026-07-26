using UnityEngine;
namespace NWD.Player {
public sealed class FirstPersonLook : MonoBehaviour {
  [SerializeField]
  Transform body;
  [SerializeField]
  float sensitivity = .1f;
  float pitch;
  public void Look(Vector2 delta) {
    if (!body)
      return;
    body.Rotate(Vector3.up * delta.x * sensitivity);
    pitch = Mathf.Clamp(pitch - delta.y * sensitivity, -85, 85);
    transform.localRotation = Quaternion.Euler(pitch, 0, 0);
  }
}
}
