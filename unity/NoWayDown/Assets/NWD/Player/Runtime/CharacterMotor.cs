using NWD.Core;
using UnityEngine;
namespace NWD.Player {
[RequireComponent(typeof(CharacterController))]
public sealed class CharacterMotor : MonoBehaviour, ICharacterMotor {
  [SerializeField]
  float walkSpeed = 4, sprintSpeed = 7, crouchSpeed = 2, jumpHeight = 1.2f,
        gravity = -20, acceleration = 18, deceleration = 24,
        airControl = .25f, standingHeight = 1.8f, crouchedHeight = 1.15f,
        crouchTransitionSpeed = 6;
  [SerializeField] LayerMask obstructionMask = ~0;
  CharacterController controller;
  float verticalVelocity;
  Vector3 horizontalVelocity;
  public bool IsGrounded { get; private set; }
  public bool IsSprinting { get; private set; }
  public bool IsCrouched { get; private set; }
  public Vector3 Velocity => horizontalVelocity + Vector3.up * verticalVelocity;
  public float HorizontalSpeed => horizontalVelocity.magnitude;
  void Awake() => controller = GetComponent<CharacterController>();
  public void Move(Vector2 movement, bool sprint, bool crouch, bool jump) {
    if (!controller || !controller.enabled)
      return;
    IsGrounded = controller.isGrounded;
    IsCrouched = crouch || (IsCrouched && !CanStand());
    IsSprinting = sprint && !IsCrouched && IsGrounded && movement.y > .1f;
    var targetHeight = IsCrouched ? crouchedHeight : standingHeight;
    controller.height = Mathf.MoveTowards(controller.height, targetHeight,
                                           crouchTransitionSpeed * Time.deltaTime);
    controller.center = Vector3.up * controller.height * .5f;
    if (IsGrounded) {
      verticalVelocity = -2;
      if (jump)
        verticalVelocity = Mathf.Sqrt(jumpHeight * -2 * gravity);
    }
    verticalVelocity += gravity * Time.deltaTime;
    var speed = IsCrouched ? crouchSpeed : IsSprinting ? sprintSpeed : walkSpeed;
    var direction = Vector3.ClampMagnitude(transform.right * movement.x +
                                            transform.forward * movement.y, 1);
    var target = direction * speed;
    var rate = direction.sqrMagnitude > .001f ? acceleration : deceleration;
    if (!IsGrounded) rate *= airControl;
    horizontalVelocity = Vector3.MoveTowards(horizontalVelocity, target,
                                              rate * Time.deltaTime);
    controller.Move(Velocity * Time.deltaTime);
  }
  bool CanStand() {
    var radius = Mathf.Max(.05f, controller.radius - .02f);
    var bottom = transform.position + Vector3.up * radius;
    var top = transform.position + Vector3.up * (standingHeight - radius);
    return !Physics.CheckCapsule(bottom, top, radius, obstructionMask,
                                 QueryTriggerInteraction.Ignore);
  }
}
}
