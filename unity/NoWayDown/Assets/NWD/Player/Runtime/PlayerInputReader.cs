using NWD.Core;
using UnityEngine;
using UnityEngine.InputSystem;
namespace NWD.Player {
public sealed class PlayerInputReader : MonoBehaviour, IPlayerInput {
  public InputActionReference move, look, sprint, crouch, jump, interact, aim,
      fire, reload, melee, nextWeapon, pause;
  public Vector2 Move => Read(move);
  public Vector2 Look => Read(look);
  public bool Sprint => Pressed(sprint);
  public bool Crouch => Pressed(crouch);
  public bool JumpPressed =>
      jump && jump.action != null && jump.action.WasPressedThisFrame();
  static Vector2 Read(InputActionReference r) =>
      r && r.action != null ? r.action.ReadValue<Vector2>() : Vector2.zero;
  static bool Pressed(InputActionReference r) => r && r.action != null
                                                 && r.action.IsPressed();
}
}
