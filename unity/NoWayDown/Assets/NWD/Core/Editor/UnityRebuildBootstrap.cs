using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using NWD.Application;
using NWD.Benchmark;
using NWD.Narrative;
using NWD.Player;
using NWD.Rendering.Editor;
using NWD.Scenes;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;

namespace NWD.EditorTools {
public static class UnityRebuildBootstrap {
  public static readonly string[] Nodes = {
    "campaign-intro", "lvl01-esc01-comedor-resistencia",
    "lvl01-esc02-pasillos-hacia-escaleras-pb", "lvl01-cin01-cierre-contextual"
  };
  const string Bootstrap = "Assets/NWD/Scenes/Bootstrap/Bootstrap.unity",
               Persistent = "Assets/NWD/Scenes/Persistent/Persistent.unity",
               Benchmark = "Assets/NWD/Scenes/Benchmark/VisualBenchmark.unity";
  [MenuItem("NWD/Bootstrap Unity Rebuild")]
  public static void Run() {
    ValidateEditorVersion();
    RequirePackages();
    RequireHdrpActive();
    var manifest = CanonicalCampaignImporter.Import();
    HdrpQualityConfiguration.ConfigureProject();
    CreateBootstrap(manifest);
    CreatePersistent(manifest);
    foreach (var node in manifest.nodes.Take(4))
      CreateCanonicalScene(node);
    CreateBenchmark();
    ConfigureBuildSettings();
    AssetDatabase.SaveAssets();
    Debug.Log("NWD rebuild preparation completed. Manual pending: restart " +
              "Unity, inspect generated scenes/materials, run both test " +
              "suites, capture benchmark, and build Windows x64 Development.");
  }
  static void ValidateEditorVersion() {
    if (!Application.unityVersion.StartsWith("6000.3.",
                                             StringComparison.Ordinal))
      throw new InvalidOperationException(
          "Unity 6.3 LTS is required. Actual Editor: " +
          Application.unityVersion);
  }
  static void RequirePackages() {
    var text = File.ReadAllText("Packages/manifest.json");
    foreach (var package in new[] { "render-pipelines.high-definition",
                                    "inputsystem", "cinemachine",
                                    "ai.navigation", "addressables",
                                    "netcode.gameobjects", "transport",
                                    "test-framework", "timeline", "ugui" })
      if (!text.Contains(package))
        throw new InvalidDataException("Missing package: " + package);
    if (text.Contains("render-pipelines.universal"))
      throw new InvalidDataException("URP is forbidden");
  }
  static void RequireHdrpActive() {
    if (!(GraphicsSettings.defaultRenderPipeline is
              UnityEngine.Rendering.HighDefinition.HDRenderPipelineAsset))
      throw new InvalidOperationException(
          "Run NWD/HDRP/Configure Project, restart Unity, then run rebuild " +
          "again.");
  }
  static Scene OpenOrNew(string path, out bool created) {
    created = !File.Exists(path);
    if (created) {
      Directory.CreateDirectory(Path.GetDirectoryName(path));
      return EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,
                                         NewSceneMode.Single);
    }
    return EditorSceneManager.OpenScene(path, OpenSceneMode.Single);
  }
  static GameObject EnsureRoot(string name) {
    var found = GameObject.Find(name);
    if (found)
      return found;
    var value = new GameObject(name);
    value.AddComponent<GeneratedContentMarker>();
    return value;
  }
  static void CreateBootstrap(CampaignManifestAsset manifest) {
    var scene = OpenOrNew(Bootstrap, out _);
    var root = EnsureRoot("NWD_Bootstrap");
    var controller = root.GetComponent<BootstrapController>() ??
                     root.AddComponent<BootstrapController>();
    new SerializedObject(controller)
        .FindProperty("manifest")
        .objectReferenceValue = manifest;
    var serialized = new SerializedObject(controller);
    serialized.FindProperty("manifest").objectReferenceValue = manifest;
    serialized.ApplyModifiedPropertiesWithoutUndo();
    EditorSceneManager.SaveScene(scene, Bootstrap);
  }
  static void CreatePersistent(CampaignManifestAsset manifest) {
    var scene = OpenOrNew(Persistent, out _);
    var root = EnsureRoot("GameCompositionRoot");
    var composition = root.GetComponent<GameCompositionRoot>() ??
                      root.AddComponent<GameCompositionRoot>();
    var serialized = new SerializedObject(composition);
    serialized.FindProperty("manifest").objectReferenceValue = manifest;
    serialized.ApplyModifiedPropertiesWithoutUndo();
    EditorSceneManager.SaveScene(scene, Persistent);
  }
  static void CreateCanonicalScene(CampaignNodeDefinition node) {
    var path = $"Assets/NWD/Scenes/Campaign/{node.id}.unity";
    var scene = OpenOrNew(path, out var created);
    var root = EnsureRoot("NWD_SceneRoot");
    var descriptor = root.GetComponent<CanonicalSceneDescriptor>() ??
                     root.AddComponent<CanonicalSceneDescriptor>();
    var spawn = EnsureChild(root.transform, "EntrySpawn");
    descriptor.Configure(node.id, node.type, spawn.transform);
    if (created) {
      Primitive("Greybox_Floor", root.transform, new Vector3(0, -.1f, 0),
                new Vector3(20, .2f, 20));
      var light = EnsureChild(root.transform, "Provisional_ColdLight")
                      .AddComponent<Light>();
      light.type = LightType.Point;
      light.range = 18;
      EnsureFlashlight(root.transform);
      EnsureChild(root.transform, "Objectives");
      EnsureChild(root.transform, "InfectedSpawns");
    }
    EditorSceneManager.SaveScene(scene, path);
  }
  static void CreateBenchmark() {
    var scene = OpenOrNew(Benchmark, out var created);
    var root = EnsureRoot("NWD_VisualBenchmark_DEVELOPMENT_ONLY");
    if (!root.GetComponent<BenchmarkDevelopmentOnly>())
      root.AddComponent<BenchmarkDevelopmentOnly>();
    if (!root.GetComponent<BenchmarkMetricsOverlay>())
      root.AddComponent<BenchmarkMetricsOverlay>();
    if (created) {
      CreateMaterialKit();
      Primitive("Floor_10x10", root.transform, new Vector3(0, -.1f, 0),
                new Vector3(10, .2f, 10));
      Primitive("Ceiling", root.transform, new Vector3(0, 3, 0),
                new Vector3(10, .15f, 10));
      foreach (var wall in new[] { (-5f, 1.5f, 0f, .2f, 3f, 10f),
                                   (5f, 1.5f, 0f, .2f, 3f, 10f),
                                   (0f, 1.5f, -5f, 10f, 3f, .2f),
                                   (0f, 1.5f, 5f, 10f, 3f, .2f) })
        Primitive("Wall", root.transform,
                  new Vector3(wall.Item1, wall.Item2, wall.Item3),
                  new Vector3(wall.Item4, wall.Item5, wall.Item6));
      for (var i = 0; i < 3; i++)
        Primitive("Column", root.transform, new Vector3(-3 + i * 3, 1.3f, 1),
                  new Vector3(.45f, 2.6f, .45f));
      Primitive("Stair_Step", root.transform, new Vector3(2, .15f, -2),
                new Vector3(2, .3f, 1));
      Primitive("Door", root.transform, new Vector3(0, 1.1f, 4.75f),
                new Vector3(1.2f, 2.2f, .15f));
      for (var i = 0; i < 3; i++)
        Primitive("Pipe", root.transform,
                  new Vector3(-3 + i * .35f, 2.6f, -4.5f),
                  new Vector3(.15f, .15f, 7), PrimitiveType.Cylinder);
      for (var i = 0; i < 5; i++)
        Primitive("Debris", root.transform,
                  new Vector3(-2 + i * .7f, .1f, -1 + i % 2),
                  Vector3.one * .2f);
      Primitive("BankFurniture", root.transform, new Vector3(-2, .5f, 2.5f),
                new Vector3(3, 1, .7f));
      Primitive("Puddle_Localized", root.transform, new Vector3(1, .015f, 1),
                new Vector3(2, .02f, 1.2f));
      CreateLight(root.transform, "Cold_Overhead", new Color(.55f, .7f, 1), 900,
                  new Vector3(0, 2.7f, 0));
      CreateLight(root.transform, "Warm_Practical", new Color(1, .55f, .25f),
                  650, new Vector3(-3, 1.8f, 2));
      CreateLight(root.transform, "Restricted_Red_Emergency",
                  new Color(1, .04f, .02f), 350, new Vector3(3, 1, -3));
      EnsureFlashlight(root.transform);
      var probe = EnsureChild(root.transform, "Reflection Probe")
                      .AddComponent<ReflectionProbe>();
      probe.size = new Vector3(9, 3, 9);
      var group = EnsureChild(root.transform, "Light Probes")
                      .AddComponent<LightProbeGroup>();
      group.probePositions =
          new[] { new Vector3(-3, .5f, -3), new Vector3(3, .5f, -3),
                  new Vector3(-3, 2, 3), new Vector3(3, 2, 3) };
      EnsureChild(root.transform, "Decal Projectors");
      var volume =
          EnsureChild(root.transform, "Benchmark Post Processing Volume")
              .AddComponent<Volume>();
      volume.isGlobal = true;
      volume.profile = AssetDatabase.LoadAssetAtPath<VolumeProfile>(
          $"{HdrpQualityConfiguration.Output}/Benchmark Volume Profile.asset");
      EnsureChild(root.transform, "Local Volumetric Humidity Dust");
      foreach (var name in new[] { "BenchmarkStart", "BenchmarkEnd",
                                   "Benchmark_Overview", "Benchmark_Flashlight",
                                   "Benchmark_WetFloor",
                                   "Benchmark_EmergencyLight" })
        EnsureChild(root.transform, name);
      var camera = EnsureChild(root.transform, "FirstPersonCamera")
                       .AddComponent<Camera>();
      camera.transform.localPosition = new Vector3(0, 1.65f, -3);
      camera.transform.LookAt(Vector3.up);
      EnsureChild(camera.transform, "WeaponPlaceholder");
      EnsureChild(root.transform, "CaptureCamera")
          .AddComponent<Camera>()
          .enabled = false;
    }
    EditorSceneManager.SaveScene(scene, Benchmark);
  }
  static void CreateMaterialKit() {
    Directory.CreateDirectory("Assets/NWD/Rendering/Materials");
    foreach (var name in new[] { "M_Concrete_Dirty", "M_PaintedWall_Damaged",
                                 "M_Metal_Rusted", "M_Wood_Worn", "M_Tile_Wet",
                                 "M_Puddle", "M_Glass_Dirty", "M_Rubber",
                                 "M_WeaponPlaceholder", "M_SkinPlaceholder" }) {
      var path = $"Assets/NWD/Rendering/Materials/{name}.mat";
      if (AssetDatabase.LoadAssetAtPath<Material>(path))
        continue;
      var shader = Shader.Find("HDRP/Lit");
      if (!shader)
        throw new InvalidOperationException("HDRP/Lit shader unavailable");
      var material = new Material(shader) { name = name };
      material.SetFloat("_Metallic",
                        name.Contains("Metal") || name.Contains("Weapon") ? .65f
                                                                          : 0f);
      material.SetFloat("_Smoothness", name.Contains("Puddle") ? .82f
                                       : name.Contains("Wet")  ? .55f
                                                               : .25f);
      AssetDatabase.CreateAsset(material, path);
    }
  }
  static void ConfigureBuildSettings() {
    var paths = new[] { Bootstrap, Persistent }.Concat(
        Nodes.Select(n => $"Assets/NWD/Scenes/Campaign/{n}.unity"));
    var scenes =
        paths.Select(p => new EditorBuildSettingsScene(p, true))
            .Concat(new[] { new EditorBuildSettingsScene(Benchmark, false) })
            .ToArray();
    EditorBuildSettings.scenes = scenes;
  }
  static GameObject EnsureChild(Transform parent, string name) {
    var child = parent.Find(name);
    if (child)
      return child.gameObject;
    var value = new GameObject(name);
    value.transform.SetParent(parent, false);
    value.AddComponent<GeneratedContentMarker>();
    return value;
  }
  static GameObject Primitive(string name, Transform parent, Vector3 position,
                              Vector3 scale,
                              PrimitiveType type = PrimitiveType.Cube) {
    var value = GameObject.CreatePrimitive(type);
    value.name = name;
    value.transform.SetParent(parent, false);
    value.transform.localPosition = position;
    value.transform.localScale = scale;
    value.AddComponent<GeneratedContentMarker>();
    return value;
  }
  static void CreateLight(Transform parent, string name, Color color,
                          float intensity, Vector3 position) {
    var value = EnsureChild(parent, name);
    var light = value.AddComponent<Light>();
    light.type = LightType.Point;
    light.color = color;
    light.intensity = intensity;
    light.range = 6;
    value.transform.localPosition = position;
  }
  static void EnsureFlashlight(Transform parent) {
    var holder = EnsureChild(parent, "PlayerFlashlight");
    if (!holder.GetComponent<Light>())
      holder.AddComponent<Light>();
    if (!holder.GetComponent<PlayerFlashlight>())
      holder.AddComponent<PlayerFlashlight>();
  }
}
}
