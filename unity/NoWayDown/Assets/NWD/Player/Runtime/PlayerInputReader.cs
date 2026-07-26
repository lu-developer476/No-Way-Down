using NWD.Core;
using UnityEngine;
using UnityEngine.InputSystem;
namespace NWD.Player {
public sealed class PlayerInputReader : MonoBehaviour, IPlayerInput {
  public InputActionReference move, look, sprint, crouch, jump, interact, aim,
      fire, reload, melee, nextWeapon, flashlight, pause;
  InputActionMap map;
  public bool IsMapEnabled => map != null && map.enabled;
  public Vector2 Move => Read(move);
  public Vector2 Look => Read(look);
  public bool Sprint => Pressed(sprint);
  public bool Crouch => Pressed(crouch);
  public bool JumpPressed =>
      jump && jump.action != null && jump.action.WasPressedThisFrame();
  public bool FlashlightPressed => PressedThisFrame(flashlight);
  public bool PausePressed => PressedThisFrame(pause);
  void OnEnable() {
    map = move && move.action != null ? move.action.actionMap : null;
    if (map == null) {
      Debug.LogError("PlayerInputReader requires a Move action assigned from the Gameplay map.", this);
      enabled = false;
      return;
    }
    map.Enable();
  }
  void OnDisable() {
    map?.Disable();
    map = null;
  }
  static Vector2 Read(InputActionReference r) =>
      r && r.action != null ? r.action.ReadValue<Vector2>() : Vector2.zero;
  static bool Pressed(InputActionReference r) => r && r.action != null
                                                 && r.action.IsPressed();
  static bool PressedThisFrame(InputActionReference r) =>
      r && r.action != null && r.action.WasPressedThisFrame();
}
}
