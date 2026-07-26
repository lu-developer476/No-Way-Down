using NWD.Combat;
using UnityEngine;
using UnityEngine.AI;
namespace NWD.Enemies {
public enum InfectedState {
  Idle,
  InvestigateNoise,
  Chase,
  Attack,
  Stagger,
  Dead
}
[RequireComponent(typeof(NavMeshAgent), typeof(HealthComponent))]
public sealed class InfectedBrain : MonoBehaviour {
  public InfectedState State { get; private set; }
  public Transform target;
  NavMeshAgent agent;
  HealthComponent health;
  void Awake() {
    agent = GetComponent<NavMeshAgent>();
    health = GetComponent<HealthComponent>();
    health.Died += OnDied;
  }
  void OnDestroy() {
    if (health)
      health.Died -= OnDied;
  }
  void OnEnable() => NoiseSystem.Emitted += Hear;
  void OnDisable() => NoiseSystem.Emitted -= Hear;
  void OnDied() {
    State = InfectedState.Dead;
    if (agent)
      agent.enabled = false;
  }
  void Hear(NoiseEvent noise) {
    if (State == InfectedState.Dead ||
        Vector3.Distance(transform.position, noise.Position) > noise.Radius)
      return;
    State = InfectedState.InvestigateNoise;
    if (agent.enabled && agent.isOnNavMesh)
      agent.SetDestination(noise.Position);
  }
  public void Tick() {
    if (!target || State == InfectedState.Dead)
      return;
    State = Vector3.Distance(transform.position, target.position) < 2
                ? InfectedState.Attack
                : InfectedState.Chase;
    if (agent.enabled && agent.isOnNavMesh)
      agent.SetDestination(target.position);
  }
}
}
