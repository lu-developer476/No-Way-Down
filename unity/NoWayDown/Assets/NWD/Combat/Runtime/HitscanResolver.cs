using NWD.Core;
using UnityEngine;
namespace NWD.Combat {
public sealed class HitscanResolver {
  public bool Resolve(Ray ray, float range, float damage, GameObject source,
                      LayerMask mask = default, float headshotMultiplier = 2) {
    if (mask.value == 0) mask = ~0;
    if (!Physics.Raycast(ray, out var hit, range, mask,
                         QueryTriggerInteraction.Ignore))
      return false;
    if (hit.transform.IsChildOf(source.transform)) return false;
    var target = hit.collider.GetComponentInParent<IDamageable>();
    var headshot = hit.collider.gameObject.layer == LayerMask.NameToLayer("Head") ||
                   hit.collider.CompareTag("Head");
    target?.ApplyDamage(new DamageInfo(damage * (headshot ? headshotMultiplier / 2f : 1),
                                       hit.point, source, headshot));
    return target != null;
  }
}
}
