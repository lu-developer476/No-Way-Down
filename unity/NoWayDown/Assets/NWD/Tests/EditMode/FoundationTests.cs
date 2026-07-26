using System.IO;
using System.Linq;
using NUnit.Framework;
using NWD.Campaign;
using NWD.EditorTools;
using NWD.Narrative;
using NWD.Rendering.Editor;
using NWD.Save;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering.HighDefinition;

namespace NWD.Tests.EditMode {
public sealed class FoundationTests {
  [Test]
  public void PackageManifestContainsHdrpAndNoUrp() {
    var text = File.ReadAllText("Packages/manifest.json");
    StringAssert.Contains("com.unity.render-pipelines.high-definition", text);
    StringAssert.DoesNotContain("com.unity.render-pipelines.universal", text);
  }
  [Test]
  public void QualityJsonHasExactValidatedBaselineAndProfiles() {
    var document = HdrpQualityConfiguration.ReadAndValidate();
    Assert.That(document.profiles.All().Select(p => p.Key),
                Is.EqualTo(new[] { "Low", "Medium", "High", "Ultra" }));
    Assert.That(document.baseline.profile, Is.EqualTo("High"));
  }
  [Test]
  public void SourceContainsExactly35OrderedUniqueNodes() {
    var json = File.ReadAllText(
        "Assets/NWD/Narrative/Source/canonical_campaign_manifest.json");
    var ids =
        JsonUtility.FromJson<Wrapper>(json).nodes.Select(n => n.id).ToArray();
    Assert.That(ids, Has.Length.EqualTo(35));
    Assert.That(ids.Distinct().Count(), Is.EqualTo(35));
    Assert.That(ids.Take(4), Is.EqualTo(UnityRebuildBootstrap.Nodes));
    Assert.False(ids.Contains("VisualBenchmark"));
  }
  [Test]
  public void GeneratedManifestNeverContainsBenchmark() {
    var manifest = CanonicalCampaignImporter.Import();
    Assert.That(manifest.nodes, Has.Count.EqualTo(35));
    Assert.False(
        manifest.nodes.Any(n => n.id.Contains("Benchmark") ||
                                n.scenePath?.Contains("Benchmark") == true));
  }
  [Test]
  public void CanonicalSceneIdsAreExact() {
    var manifest = CanonicalCampaignImporter.Import();
    Assert.That(manifest.nodes.Take(4).Select(n => n.id),
                Is.EqualTo(UnityRebuildBootstrap.Nodes));
  }
  [Test]
  public void AssemblyDefinitionsReferenceResolvableAssemblies() {
    foreach (var guid in AssetDatabase.FindAssets("t:AssemblyDefinitionAsset",
                                                  new[] { "Assets/NWD" })) {
      var path = AssetDatabase.GUIDToAssetPath(guid);
      var text = File.ReadAllText(path);
      Assert.False(text.Contains("render-pipelines.universal"), path);
    }
  }
  [Test]
  public void DirectorDoesNotAdvanceOrSaveBeforeDestinationConfirmation() {
    var go = new GameObject();
    var director = go.AddComponent<CampaignDirector>();
    var manifest = ScriptableObject.CreateInstance<CampaignManifestAsset>();
    manifest.sourceHash = "hash";
    manifest.nodes.Add(new CampaignNodeDefinition { id = "a" });
    manifest.nodes.Add(new CampaignNodeDefinition { id = "b" });
    var saves = new SaveSpy();
    director.Configure(manifest, saves);
    director.StartNewCampaign();
    Assert.True(director.RequestTransition("test"));
    Assert.That(director.GetCurrentNode().id, Is.EqualTo("a"));
    Assert.That(saves.Count, Is.Zero);
    Assert.False(director.ConfirmDestinationReady("wrong"));
    Assert.That(saves.Count, Is.Zero);
    Assert.True(director.ConfirmDestinationReady("b"));
    Assert.That(saves.Count, Is.EqualTo(1));
    Object.DestroyImmediate(go);
  }
  [Test]
  public void GeneratedHdrpAssetsUseHighByDefault() {
    var high = AssetDatabase.LoadAssetAtPath<HDRenderPipelineAsset>(
        $"{HdrpQualityConfiguration.Output}/NWD HDRP High.asset");
    if (!high)
      Assert.Fail("HDRP setup was not executed before the test suite.");
    Assert.That(UnityEngine.Rendering.GraphicsSettings.defaultRenderPipeline,
                Is.SameAs(high));
  }
  [Test]
  public void BootstrapRebuildIsIdempotent() {
    if (!(UnityEngine.Rendering.GraphicsSettings.defaultRenderPipeline is
              HDRenderPipelineAsset))
      Assert.Fail("HDRP must be active before the configured CI test suite.");
    UnityRebuildBootstrap.Run();
    var first =
        AssetDatabase.FindAssets("t:Scene", new[] { "Assets/NWD/Scenes" })
            .OrderBy(x => x)
            .ToArray();
    UnityRebuildBootstrap.Run();
    var second =
        AssetDatabase.FindAssets("t:Scene", new[] { "Assets/NWD/Scenes" })
            .OrderBy(x => x)
            .ToArray();
    Assert.That(second, Is.EqualTo(first));
  }
  sealed class SaveSpy : ISaveService {
    public int Count;
    public SaveGameData Load() => null;
    public void Save(SaveGameData data) => Count++;
  }
  [System.Serializable]
  sealed class Wrapper {
    public Node[] nodes;
  }
  [System.Serializable]
  sealed class Node {
    public string id;
  }
}
}
