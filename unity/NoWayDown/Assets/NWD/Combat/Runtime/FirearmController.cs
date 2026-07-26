using UnityEngine;
namespace NWD.Combat {
public sealed class FirearmController : MonoBehaviour {
  [SerializeField]
  WeaponDefinition definition;
  [SerializeField]
  Camera aimCamera;
  int magazine, reserve = 60;
  readonly HitscanResolver hitscan = new HitscanResolver();
  public int Magazine => magazine;
  public int Reserve => reserve;
  void Awake() => magazine = definition ? definition.magazineSize : 0;
  public bool Fire() {
    if (magazine <= 0 || !definition)
      return false;
    magazine--;
    var ray = aimCamera ? new Ray(aimCamera.transform.position,
                                  aimCamera.transform.forward)
                        : new Ray(transform.position, transform.forward);
    hitscan.Resolve(ray, definition.range, definition.damage, gameObject);
    NoiseSystem.Emit(new NoiseEvent(transform.position, 1,
                                    definition.noiseRadius, 1,
                                    NoiseCategory.Gunshot, gameObject));
    return true;
  }
  public int Reload() {
    if (!definition)
      return 0;
    var count = Mathf.Min(definition.magazineSize - magazine, reserve);
    magazine += count;
    reserve -= count;
    return count;
  }
}
}
