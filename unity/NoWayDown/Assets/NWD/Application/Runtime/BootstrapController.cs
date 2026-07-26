using System.Collections;
using NWD.Narrative;
using UnityEngine;
using UnityEngine.SceneManagement;
namespace NWD.Application {
public enum BootstrapMode { NewCampaign, Continue, Benchmark }
public sealed class BootstrapController : MonoBehaviour {
  const string PersistentPath = "Assets/NWD/Scenes/Persistent/Persistent.unity";
  const string BenchmarkPath =
      "Assets/NWD/Scenes/Benchmark/VisualBenchmark.unity";
  [SerializeField]
  BootstrapMode mode;
  [SerializeField]
  CampaignManifestAsset manifest;
  bool starting;
  public IEnumerator StartFlow(BootstrapMode requested) {
    if (starting)
      yield break;
    starting = true;
    if (!GameCompositionRoot.Instance) {
      var op =
          SceneManager.LoadSceneAsync(PersistentPath, LoadSceneMode.Additive);
      if (op == null) {
        starting = false;
        throw new System.InvalidOperationException(
            "Persistent scene missing from Build Settings");
      }
      while (!op.isDone)
        yield return null;
    }
    while (!GameCompositionRoot.Instance ||
           !GameCompositionRoot.Instance.IsReady)
      yield return null;
    var root = GameCompositionRoot.Instance;
    root.Configure(manifest);
    if (requested == BootstrapMode.Benchmark) {
      root.Session.IsBenchmark = true;
      yield return root.Scenes.LoadAdditive(BenchmarkPath);
      starting = false;
      yield break;
    }
    if (!manifest || manifest.nodes.Count == 0) {
      starting = false;
      throw new System.InvalidOperationException(
          "Canonical manifest not assigned");
    }
    if (requested == BootstrapMode.NewCampaign)
      root.Campaign.StartNewCampaign();
    else
      root.Campaign.ContinueCampaign();
    var node = root.Campaign.GetCurrentNode();
    yield return root.Scenes.LoadAdditive(node.scenePath);
    starting = false;
  }
  IEnumerator Start() => StartFlow(mode);
}
}
