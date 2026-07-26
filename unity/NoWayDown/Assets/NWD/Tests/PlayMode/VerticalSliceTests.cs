using System.Collections;
using System.Linq;
using NUnit.Framework;
using NWD.Application;
using NWD.Player;
using NWD.Scenes;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.HighDefinition;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace NWD.Tests.PlayMode {
public sealed class VerticalSliceTests {
  const string Bootstrap = "Assets/NWD/Scenes/Bootstrap/Bootstrap.unity";
  [UnityTest]
  public IEnumerator BootstrapLoadsPersistentAndInitialCanonicalScene() {
    if (!UnityEngine.Application.CanStreamedLevelBeLoaded(Bootstrap))
      Assert.Ignore("Generate scenes with NWD/Bootstrap Unity Rebuild first.");
    yield return SceneManager.LoadSceneAsync(Bootstrap, LoadSceneMode.Single);
    yield return WaitForScene("Persistent", 10);
    yield return WaitForScene("campaign-intro", 10);
    Assert.That(
        Object.FindObjectsByType<GameCompositionRoot>(FindObjectsSortMode.None),
        Has.Length.EqualTo(1));
    Assert.That(GameCompositionRoot.Instance.Campaign.GetCurrentNode().id,
                Is.EqualTo("campaign-intro"));
    Assert.That(GraphicsSettings.currentRenderPipeline,
                Is.TypeOf<HDRenderPipelineAsset>());
  }
  [UnityTest]
  public IEnumerator CanonicalTransitionLoadsComedorOnceAndUnloadsIntro() {
    if (!GameCompositionRoot.Instance)
      Assert.Ignore("Bootstrap integration test must run first or scenes " +
                    "must be generated.");
    Assert.True(GameCompositionRoot.Instance.Campaign.RequestTransition(
        "playmode-test"));
    yield return WaitForScene("lvl01-esc01-comedor-resistencia", 10);
    yield return WaitUntil(
        () => !SceneManager.GetSceneByName("campaign-intro").isLoaded, 10);
    Assert.That(GameCompositionRoot.Instance.Campaign.GetCurrentNode().id,
                Is.EqualTo("lvl01-esc01-comedor-resistencia"));
    Assert.That(
        LoadedScenes().Count(n => n == "lvl01-esc01-comedor-resistencia"),
        Is.EqualTo(1));
  }
  [UnityTest]
  public IEnumerator
  VisualBenchmarkHasRequiredRuntimeSystemsAndCannotAdvanceCampaign() {
    const string benchmark =
        "Assets/NWD/Scenes/Benchmark/VisualBenchmark.unity";
    if (!UnityEngine.Application.CanStreamedLevelBeLoaded(benchmark))
      Assert.Ignore(
          "Benchmark is intentionally excluded from normal Build Settings; " +
          "execute this test in the dedicated Development configuration.");
    var before = GameCompositionRoot.Instance?.Campaign.GetCurrentNode()?.id;
    yield return SceneManager.LoadSceneAsync(benchmark, LoadSceneMode.Additive);
    Assert.NotNull(Object.FindFirstObjectByType<PlayerFlashlight>());
    Assert.NotNull(Object.FindFirstObjectByType<Volume>());
    Assert.That(Object
                    .FindObjectsByType<CanonicalSceneDescriptor>(
                        FindObjectsSortMode.None)
                    .All(x => x.NodeId != "VisualBenchmark"));
    Assert.That(GameCompositionRoot.Instance?.Campaign.GetCurrentNode()?.id,
                Is.EqualTo(before));
  }
  static IEnumerator WaitForScene(string name, float timeout) {
    yield return WaitUntil(() => SceneManager.GetSceneByName(name).isLoaded,
                           timeout);
    Assert.True(SceneManager.GetSceneByName(name).isLoaded,
                "Scene did not load: " + name);
  }
  static IEnumerator WaitUntil(System.Func<bool> predicate, float timeout) {
    var end = Time.realtimeSinceStartup + timeout;
    while (!predicate() && Time.realtimeSinceStartup < end)
      yield return null;
  }
  static string[] LoadedScenes() {
    var values = new string[SceneManager.sceneCount];
    for (var i = 0; i < values.Length; i++)
      values[i] = SceneManager.GetSceneAt(i).name;
    return values;
  }
}
}
