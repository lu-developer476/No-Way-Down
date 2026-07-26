using NWD.Core;
using UnityEngine;
namespace NWD.Combat {
public sealed class HitscanResolver {
  public bool Resolve(Ray ray, float range, float damage, GameObject source) {
    if (!Physics.Raycast(ray, out var hit, range))
      return false;
    var target = hit.collider.GetComponentInParent<IDamageable>();
    target?.ApplyDamage(new DamageInfo(damage, hit.point, source,
                                       hit.collider.CompareTag("Head")));
    return target != null;
  }
}
}
