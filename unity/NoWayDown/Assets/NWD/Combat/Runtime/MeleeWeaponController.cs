using UnityEngine;
namespace NWD.Combat {
public sealed class MeleeWeaponController : MonoBehaviour {
  [SerializeField]
  WeaponDefinition definition;
  readonly HitscanResolver hitscan = new HitscanResolver();
  public bool
  Strike(Ray ray) => definition && hitscan.Resolve(ray, definition.range,
                                                   definition.damage,
                                                   gameObject);
}
}
