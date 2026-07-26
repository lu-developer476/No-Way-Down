using System;
using UnityEngine;
namespace NWD.Missions {
public sealed class ObjectiveRuntime {
  public ObjectiveDefinition Definition { get; }
  public ObjectiveState State { get; private set; }
  public float Progress { get; private set; }
  public event Action Started, Completed, Failed;
  public ObjectiveRuntime(ObjectiveDefinition definition) => Definition =
      definition;
  public bool Start() {
    if (State != ObjectiveState.Locked)
      return false;
    State = ObjectiveState.Active;
    Started?.Invoke();
    return true;
  }
  public bool SetProgress(float value) {
    if (State != ObjectiveState.Active)
      return false;
    Progress = Mathf.Clamp01(value);
    if (Progress >= 1) {
      State = ObjectiveState.Completed;
      Completed?.Invoke();
    }
    return true;
  }
  public bool Fail() {
    if (State != ObjectiveState.Active)
      return false;
    State = ObjectiveState.Failed;
    Failed?.Invoke();
    return true;
  }
}
}
