using UnityEngine;
namespace NWD.Combat {
[CreateAssetMenu(menuName = "NWD/Weapon")]
public sealed class WeaponDefinition : ScriptableObject {
  public string weaponId;
  public bool melee;
  public float damage = 20, headshotMultiplier = 2, range = 80, spread = .01f,
               recoil = 1, noiseRadius = 25, roundsPerSecond = 4;
  public int magazineSize = 12;
  public LayerMask hitMask = ~0;
}
}
