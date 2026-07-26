using NWD.Core;
using UnityEngine;
namespace NWD.Player {
[RequireComponent(typeof(CharacterController))]
public sealed class CharacterMotor : MonoBehaviour, ICharacterMotor {
  [SerializeField]
  float walkSpeed = 4, sprintSpeed = 7, crouchSpeed = 2, jumpHeight = 1.2f,
        gravity = -20;
  CharacterController controller;
  float verticalVelocity;
  void Awake() => controller = GetComponent<CharacterController>();
  public void Move(Vector2 movement, bool sprint, bool crouch, bool jump) {
    if (!controller || !controller.enabled)
      return;
    if (controller.isGrounded) {
      verticalVelocity = -2;
      if (jump)
        verticalVelocity = Mathf.Sqrt(jumpHeight * -2 * gravity);
    }
    verticalVelocity += gravity * Time.deltaTime;
    var speed = crouch ? crouchSpeed : sprint ? sprintSpeed : walkSpeed;
    controller.Move(
        (transform.right * movement.x + transform.forward * movement.y) *
            speed * Time.deltaTime +
        Vector3.up * verticalVelocity * Time.deltaTime);
  }
}
}
