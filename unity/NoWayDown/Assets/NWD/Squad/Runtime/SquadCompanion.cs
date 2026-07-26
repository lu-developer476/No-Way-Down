using UnityEngine;
using UnityEngine.AI;
namespace NWD.Squad {
public enum CompanionState {
  Follow,
  Hold,
  MoveTo,
  Engage,
  Revive,
  Interact,
  Downed
}
public interface ISquadMember {
  string CharacterId { get; }
  CompanionState State { get; }
  void Command(CompanionState state, Vector3 position);
}
[RequireComponent(typeof(NavMeshAgent))]
public sealed class SquadCompanion : MonoBehaviour, ISquadMember {
  [SerializeField]
  string characterId;
  [SerializeField]
  Transform leader;
  [SerializeField]
  float followDistance = 3, lostDistance = 40;
  NavMeshAgent agent;
  public string CharacterId => characterId;
  public CompanionState State { get; private set; }
  void Awake() => agent = GetComponent<NavMeshAgent>();
  public void Command(CompanionState s, Vector3 p) {
    State = s;
    if (agent.isOnNavMesh)
      agent.SetDestination(p);
  }
  void Update() {
    if (State != CompanionState.Follow || !leader)
      return;
    var d = Vector3.Distance(transform.position, leader.position);
    if (d > followDistance && agent.isOnNavMesh)
      agent.SetDestination(leader.position);
    if (d > lostDistance &&
        NavMesh.SamplePosition(leader.position - transform.forward * 2,
                               out var hit, 5, NavMesh.AllAreas))
      agent.Warp(hit.position);
  }
}
}
