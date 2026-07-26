using System;
using System.Collections.Generic;
namespace NWD.Save {
[Serializable]
public sealed class SaveGameData {
  public int version = 1;
  public string manifestHash, nodeId, checkpoint, protagonist, difficulty;
  public int canonicalIndex, ammunition;
  public float health;
  public List<string> activeSquad = new List<string>(),
                      deadCharacters = new List<string>(),
                      rescuedCharacters = new List<string>(),
                      infectedCharacters = new List<string>(),
                      irreversibleEvents = new List<string>(),
                      viewedCinematics = new List<string>(),
                      inventory = new List<string>(),
                      weapons = new List<string>(),
                      persistentObjectives = new List<string>();
  public bool
  IsComplete() => version > 0 && !string.IsNullOrWhiteSpace(manifestHash) &&
                  !string.IsNullOrWhiteSpace(nodeId) && canonicalIndex >= 0;
}
}
