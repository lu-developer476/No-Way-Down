using System;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.HighDefinition;

namespace NWD.EditorTools {
[InitializeOnLoad]
public static class ProjectSetupCoordinator {
  enum Phase { None, Prepared, AwaitingReload, Generating, Validating }
  static readonly string Key = "NWD.Setup." +
      CanonicalCampaignImporter.Hash(Path.GetFullPath(".")).Substring(0, 12) +
      ".Phase";
  static ProjectSetupCoordinator() {
    EditorApplication.delayCall += ResumeIfRequested;
    if (Environment.GetEnvironmentVariable("NWD_AUTO_SETUP") == "1")
      EditorApplication.delayCall += RunComplete;
  }
  [MenuItem("NWD/Setup/Prepare HDRP Project")]
  public static void Prepare() {
    Execute(() => {
      UnityRebuildBootstrap.ValidateEditorVersion();
      UnityRebuildBootstrap.RequirePackages();
      Rendering.Editor.HdrpQualityConfiguration.ConfigureProject();
      Set(Phase.Prepared);
      Debug.Log("NWD HDRP assets were prepared and High assigned. If the pipeline is not active after serialization, restart Unity; complete setup will resume once.");
    });
  }
  [MenuItem("NWD/Setup/Validate Full Project")]
  public static void Validate() {
    Execute(() => {
      Set(Phase.Validating);
      UnityRebuildBootstrap.ValidateEditorVersion();
      UnityRebuildBootstrap.RequirePackages();
      UnityRebuildBootstrap.RequireHdrpActive();
      Rendering.Editor.HdrpQualityConfiguration.ValidateQualityProfiles();
      foreach (var path in new[] { "Assets/NWD/Scenes/Bootstrap/Bootstrap.unity",
                                   "Assets/NWD/Scenes/Persistent/Persistent.unity",
                                   "Assets/NWD/Scenes/Benchmark/VisualBenchmark.unity" })
        if (!File.Exists(path)) throw new InvalidDataException("Generated scene missing: " + path);
      Clear();
      Debug.Log("NWD full project validation completed.");
    });
  }
  [MenuItem("NWD/Setup/Run Complete Setup")]
  public static void RunComplete() {
    Execute(() => {
      if (!(GraphicsSettings.defaultRenderPipeline is HDRenderPipelineAsset)) {
        Prepare();
        if (GraphicsSettings.defaultRenderPipeline is HDRenderPipelineAsset) {
          GenerateAndValidate();
          return;
        }
        Set(Phase.AwaitingReload);
        return;
      }
      GenerateAndValidate();
    });
  }
  static void ResumeIfRequested() {
    if (Get() != Phase.AwaitingReload) return;
    if (!(GraphicsSettings.defaultRenderPipeline is HDRenderPipelineAsset)) {
      Debug.LogWarning("NWD complete setup is waiting for one Unity restart so HDRP can become active. It will not retry in this session.");
      return;
    }
    GenerateAndValidate();
  }
  static void GenerateAndValidate() {
    Set(Phase.Generating);
    UnityRebuildBootstrap.Run();
    Validate();
  }
  static void Execute(Action action) {
    try { action(); }
    catch (Exception exception) { Clear(); Debug.LogException(exception); throw; }
  }
  static Phase Get() => (Phase)SessionState.GetInt(Key, 0);
  static void Set(Phase phase) => SessionState.SetInt(Key, (int)phase);
  static void Clear() => SessionState.EraseInt(Key);
}
}
