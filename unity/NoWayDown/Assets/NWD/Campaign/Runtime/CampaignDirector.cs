using System;
using NWD.Narrative;
using NWD.Save;
using UnityEngine;
namespace NWD.Campaign {
public sealed class CampaignDirector : MonoBehaviour {
  [SerializeField]
  CampaignManifestAsset manifest;
  ISaveService saves;
  int index = -1;
  string pendingId;
  bool transitioning;
  public event Action<CampaignNodeDefinition, string> TransitionRequested;
  public event Action<string, Exception> TransitionFailed;
  public void Configure(CampaignManifestAsset m, ISaveService s) {
    manifest = m;
    saves = s;
  }
  public void StartNewCampaign() {
    index = 0;
    pendingId = null;
    transitioning = false;
  }
  public void ContinueCampaign() {
    var d = saves.Load();
    if (d == null || d.manifestHash != manifest.sourceHash ||
        manifest.IndexOf(d.nodeId) != d.canonicalIndex)
      throw new InvalidOperationException("Save does not match canon");
    index = d.canonicalIndex;
  }
  public bool
  RequestTransition(string reason) => RequestTransitionToCanonicalNext(reason);
  public bool RequestTransitionToCanonicalNext(string reason) {
    if (transitioning)
      return false;
    var n = GetNextNode();
    if (n == null)
      return false;
    transitioning = true;
    pendingId = n.id;
    TransitionRequested?.Invoke(n, reason);
    return true;
  }
  public bool ConfirmDestinationReady(string nodeId) {
    if (!transitioning || pendingId != nodeId)
      return false;
    index++;
    pendingId = null;
    transitioning = false;
    SaveCampaign();
    return true;
  }
  public void CancelTransition() {
    pendingId = null;
    transitioning = false;
  }
  public void FailTransition(string stage, Exception error) {
    CancelTransition();
    TransitionFailed?.Invoke(stage, error);
  }
  public CampaignNodeDefinition GetCurrentNode() => manifest?.At(index);
  public CampaignNodeDefinition GetNextNode() => manifest?.At(index + 1);
  public void SaveCampaign() {
    if (saves == null)
      return;
    saves.Save(new SaveGameData { manifestHash = manifest.sourceHash,
                                  nodeId = GetCurrentNode().id,
                                  canonicalIndex = index, health = 100 });
  }
}
}
