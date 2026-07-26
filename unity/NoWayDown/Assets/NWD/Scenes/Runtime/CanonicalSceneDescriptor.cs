using System.Collections.Generic;
using NWD.Application;
using NWD.Missions;
using NWD.Narrative;
using UnityEngine;
namespace NWD.Scenes {
public sealed class CanonicalSceneDescriptor : MonoBehaviour {
  [SerializeField]
  string nodeId;
  [SerializeField]
  CampaignNodeType nodeType;
  [SerializeField]
  Transform entrySpawn;
  [SerializeField]
  List<ObjectiveDefinition> objectives = new List<ObjectiveDefinition>();
  public string NodeId => nodeId;
  public CampaignNodeType NodeType => nodeType;
  public Transform EntrySpawn => entrySpawn;
  public IReadOnlyList<ObjectiveDefinition> Objectives => objectives;
  public void Configure(string id, CampaignNodeType type, Transform spawn) {
    nodeId = id;
    nodeType = type;
    entrySpawn = spawn;
  }
  void Start() {
    var campaign = GameCompositionRoot.Instance?.Campaign;
    if (campaign != null)
      campaign.ConfirmDestinationReady(nodeId);
  }
}
}
