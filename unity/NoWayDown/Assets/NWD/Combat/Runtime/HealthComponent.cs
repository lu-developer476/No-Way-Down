using System;
using NWD.Core;
using UnityEngine;
namespace NWD.Combat {
public sealed class HealthComponent : MonoBehaviour, IDamageable {
  [SerializeField]
  float maximum = 100;
  public float Current { get; private set; }
  public bool Dead => Current <= 0;
  public event Action Died;
  public float Maximum => maximum;
  void Awake() => Current = maximum;
  public void ApplyDamage(DamageInfo damage) {
    if (Dead)
      return;
    Current = Mathf.Max(0, Current - damage.Amount * (damage.Headshot ? 2 : 1));
    if (Dead)
      Died?.Invoke();
  }
}
}
