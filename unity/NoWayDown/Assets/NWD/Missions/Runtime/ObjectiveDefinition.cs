using System.Collections.Generic;
using UnityEngine;
namespace NWD.Missions {
public enum ObjectiveType {
  ReachArea,
  HoldArea,
  KillCount,
  Interact,
  Defend,
  Escape,
  SurviveTimer,
  CinematicTrigger
}
public enum ObjectiveState { Locked, Active, Completed, Failed }
[CreateAssetMenu(menuName = "NWD/Objective")]
public sealed class ObjectiveDefinition : ScriptableObject {
  public string stableId;
  public ObjectiveType type;
  public string text;
  public List<string> prerequisites = new List<string>();
  public bool persistent;
}
}
