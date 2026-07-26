using UnityEngine;
namespace NWD.Combat {
public sealed class NoiseEmitter : MonoBehaviour {
  public void Emit(NoiseCategory category, float intensity, float radius,
                   float duration) =>
      NoiseSystem.Emit(new NoiseEvent(transform.position, intensity, radius,
                                      duration, category, gameObject));
}
}
