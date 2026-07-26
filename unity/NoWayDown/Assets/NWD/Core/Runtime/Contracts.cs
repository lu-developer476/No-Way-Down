using UnityEngine;
namespace NWD.Core {
 public interface IDamageable { void ApplyDamage(DamageInfo damage); }
 public readonly struct DamageInfo { public readonly float Amount; public readonly Vector3 Point; public readonly GameObject Source; public readonly bool Headshot; public DamageInfo(float amount, Vector3 point, GameObject source=null, bool headshot=false){Amount=amount;Point=point;Source=source;Headshot=headshot;} }
 public interface ICharacterMotor { void Move(Vector2 movement, bool sprint, bool crouch, bool jump); }
 public interface IInteractor { bool Interact(); } public interface IWeaponUser { void Fire(); void Reload(); }
 public interface IInventoryOwner {} public interface IAimProvider { Ray AimRay { get; } }
 public interface IPlayerInput { Vector2 Move {get;} Vector2 Look {get;} bool Sprint {get;} bool Crouch {get;} }
}
