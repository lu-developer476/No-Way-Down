using UnityEngine;
namespace NWD.Player {
public sealed class PlayerAvatar : MonoBehaviour {
  [SerializeField]
  CharacterMotor motor;
  [SerializeField]
  FirstPersonLook cameraLook;
  [SerializeField]
  PlayerInputReader input;
  void Awake() {
    motor = motor ? motor : GetComponent<CharacterMotor>();
    input = input ? input : GetComponent<PlayerInputReader>();
  }
  void Update() {
    if (!motor || !input)
      return;
    motor.Move(input.Move, input.Sprint, input.Crouch, input.JumpPressed);
    if (cameraLook)
      cameraLook.Look(input.Look);
  }
}
}
