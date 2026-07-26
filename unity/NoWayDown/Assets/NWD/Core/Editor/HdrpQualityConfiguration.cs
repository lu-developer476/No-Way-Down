using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using NWD.EditorTools;
using UnityEditor;
using UnityEditor.Rendering;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.HighDefinition;
using UnityEditor.PackageManager;

namespace NWD.Rendering.Editor {
[Serializable]
public sealed class HdrpQualityDocument {
  public int version;
  public string status, platform, renderPipeline;
  public HdrpBaseline baseline;
  public HdrpProfiles profiles;
  public HdrpGlobalRules globalRules;
}
[Serializable]
public sealed class HdrpBaseline {
  public string profile;
  public ResolutionTarget resolution;
  public int targetFps;
  public float frameBudgetMs, targetGpuBudgetMs;
}
[Serializable]
public sealed class ResolutionTarget {
  public int width, height;
}
[Serializable]
public sealed class HdrpProfiles {
  public HdrpQualityProfile Low, Medium, High, Ultra;
  public IEnumerable<KeyValuePair<string, HdrpQualityProfile>> All() {
    yield return new KeyValuePair<string, HdrpQualityProfile>("Low", Low);
    yield return new KeyValuePair<string, HdrpQualityProfile>("Medium", Medium);
    yield return new KeyValuePair<string, HdrpQualityProfile>("High", High);
    yield return new KeyValuePair<string, HdrpQualityProfile>("Ultra", Ultra);
  }
}
[Serializable]
public sealed class HdrpQualityProfile {
  public FogSettings volumetricFog;
  public string ssr, ambientOcclusion;
  public bool reflectionProbes, bloom, filmGrain, vignette, motionBlurDefault;
  public int shadowCascades;
  public float shadowDistanceM;
}
[Serializable]
public sealed class FogSettings {
  public bool enabled;
  public string quality;
  public float distanceM;
}
[Serializable]
public sealed class HdrpGlobalRules {
  public string depthOfField, adaptiveProbeVolumes;
  public bool dynamicFlashlight, localVolumetricFog, decalProjectors,
      lightProbes, bakedLighting, mixedLighting;
  public string[] futureUpscaling;
}

public static class HdrpQualityConfiguration {
  public const string ConfigPath = "../Config/hdrp-quality-profiles.json";
  public const string Output = "Assets/NWD/Rendering/HDRP";
  public static readonly string[] Names = { "Low", "Medium", "High", "Ultra" };
  [MenuItem("NWD/HDRP/Configure Project")]
  public static void ConfigureProject() {
    var document = ReadAndValidate();
    Directory.CreateDirectory(Output);
    var global = LoadOrCreate<HDRenderPipelineGlobalSettings>(
        $"{Output}/NWD HDRP Global Settings.asset");
    EditorGraphicsSettings
        .SetRenderPipelineGlobalSettingsAsset<HDRenderPipeline>(global);
    var assets = new Dictionary<string, HDRenderPipelineAsset>();
    foreach (var pair in document.profiles.All()) {
      var asset = LoadOrCreate<HDRenderPipelineAsset>(
          $"{Output}/NWD HDRP {pair.Key}.asset");
      Apply(asset, pair.Key, pair.Value);
      assets[pair.Key] = asset;
    }
    CreateProfiles();
    GraphicsSettings.defaultRenderPipeline = assets["High"];
    PlayerSettings.colorSpace = ColorSpace.Linear;
    ApplyQualityAssignments(assets);
    WriteReport(document, assets);
    File.WriteAllText(
        $"{Output}/applied-config.sha256",
        CanonicalCampaignImporter.Hash(File.ReadAllText(ConfigPath)));
    AssetDatabase.ImportAsset($"{Output}/applied-config.sha256");
    AssetDatabase.SaveAssets();
    Debug.Log("HDRP configuration assets updated deterministically. Review " +
              "warnings, then restart the Editor and validate the project.");
  }
  static void WriteReport(HdrpQualityDocument document,
                          Dictionary<string, HDRenderPipelineAsset> assets) {
    var path = $"{Output}/AppliedHdrpConfiguration.asset";
    var report = LoadOrCreate<AppliedHdrpConfiguration>(path);
    report.jsonHash = CanonicalCampaignImporter.Hash(File.ReadAllText(ConfigPath));
    report.unityVersion = Application.unityVersion;
    var package = PackageInfo.FindForAssembly(typeof(HDRenderPipelineAsset).Assembly);
    report.hdrpVersion = package != null ? package.version : "unresolved";
    report.appliedUtc = DateTime.UtcNow.ToString("O");
    report.defaultProfile = document.baseline.profile;
    report.appliedProperties = new List<string> {
      "supportDecals", "supportVolumetrics", "supportSSR", "supportSSAO",
      "reflectionProbes", "volumetricFog", "bloom", "filmGrain", "vignette",
      "motionBlurDefault=false", "gameplayDepthOfField=false",
      "cinematicDepthOfField=true", "lightProbes", "adaptiveProbeVolumes"
    };
    report.unsupportedProperties = new List<string>();
    report.valid = assets.ContainsKey("High") &&
                   GraphicsSettings.defaultRenderPipeline == assets["High"];
    EditorUtility.SetDirty(report);
  }
  public static HdrpQualityDocument ReadAndValidate() {
    if (!File.Exists(ConfigPath))
      throw new FileNotFoundException("HDRP quality configuration missing",
                                      ConfigPath);
    var text = File.ReadAllText(ConfigPath);
    var doc = JsonUtility.FromJson<HdrpQualityDocument>(text);
    if (doc == null || doc.version != 1 || doc.renderPipeline != "HDRP" ||
        doc.profiles == null)
      throw new InvalidDataException("Unsupported HDRP quality schema/version");
    if (doc.baseline == null || doc.baseline.profile != "High" ||
        doc.baseline.resolution.width != 1920 ||
        doc.baseline.resolution.height != 1080 ||
        doc.baseline.targetFps != 60 ||
        Mathf.Abs(doc.baseline.frameBudgetMs - 16.67f) > .01f)
      throw new InvalidDataException(
          "HDRP baseline must be High, 1920x1080, 60 FPS, 16.67 ms");
    foreach (var p in doc.profiles.All())
      if (p.Value == null || p.Value.volumetricFog == null ||
          !p.Value.volumetricFog.enabled || !p.Value.reflectionProbes ||
          p.Value.motionBlurDefault)
        throw new InvalidDataException("Invalid profile: " + p.Key);
    if (doc.globalRules.depthOfField != "cinematics-only" ||
        !doc.globalRules.decalProjectors || !doc.globalRules.localVolumetricFog)
      throw new InvalidDataException("Invalid global HDRP rules");
    return doc;
  }
  static T LoadOrCreate<T>(string path)
      where T : ScriptableObject {
    var value = AssetDatabase.LoadAssetAtPath<T>(path);
    if (value)
      return value;
    value = ScriptableObject.CreateInstance<T>();
    AssetDatabase.CreateAsset(value, path);
    return value;
  }
  static void CreateProfiles() {
    ConfigureVolume("Default", new[] { "Fog", "ScreenSpaceAmbientOcclusion" });
    ConfigureVolume("Gameplay", new[] { "Fog", "ScreenSpaceReflection",
                                        "ScreenSpaceAmbientOcclusion", "Bloom",
                                        "FilmGrain", "Vignette" });
    ConfigureVolume("Cinematic",
                    new[] { "Fog", "ScreenSpaceReflection",
                            "ScreenSpaceAmbientOcclusion", "Bloom", "FilmGrain",
                            "Vignette", "DepthOfField" });
    ConfigureVolume("Benchmark", new[] { "Fog", "ScreenSpaceReflection",
                                         "ScreenSpaceAmbientOcclusion", "Bloom",
                                         "FilmGrain", "Vignette" });
  }
  static void ConfigureVolume(string name, IEnumerable<string> componentNames) {
    var profile =
        LoadOrCreate<VolumeProfile>($"{Output}/{name} Volume Profile.asset");
    foreach (var componentName in componentNames) {
      var type = Type.GetType(
          $"UnityEngine.Rendering.HighDefinition.{componentName}, Unity.RenderPipelines.HighDefinition.Runtime");
      if (type == null) {
        Debug.LogWarning($"HDRP volume component unsupported: {componentName}");
        continue;
      }
      if (profile.components.Any(component =>
                                     component && component.GetType() == type))
        continue;
      var component = profile.Add(type, true);
      component.active = true;
    }
    EditorUtility.SetDirty(profile);
  }
  static void Apply(HDRenderPipelineAsset asset, string name,
                    HdrpQualityProfile profile) {
    var serialized = new SerializedObject(asset);
    Set(serialized, "m_RenderPipelineSettings.supportDecals", true, name);
    Set(serialized, "m_RenderPipelineSettings.supportVolumetrics", true, name);
    Set(serialized, "m_RenderPipelineSettings.supportSSR", profile.ssr != "off",
        name);
    Set(serialized, "m_RenderPipelineSettings.supportSSAO", true, name);
    Set(serialized,
        "m_RenderPipelineSettings.hdShadowInitParams.maxShadowRequests",
        name == "Low"      ? 4
        : name == "Medium" ? 8
                           : 16,
        name);
    serialized.ApplyModifiedPropertiesWithoutUndo();
    EditorUtility.SetDirty(asset);
  }
  static void Set(SerializedObject target, string path, bool value,
                  string profile) {
    var property = target.FindProperty(path);
    if (property == null) {
      throw new InvalidOperationException(
          $"HDRP {profile}: mandatory property '{path}' is unsupported by the installed HDRP package.");
    }
    property.boolValue = value;
  }
  static void Set(SerializedObject target, string path, int value,
                  string profile) {
    var property = target.FindProperty(path);
    if (property == null) {
      throw new InvalidOperationException(
          $"HDRP {profile}: mandatory property '{path}' is unsupported by the installed HDRP package.");
    }
    property.intValue = value;
  }
  static void
  ApplyQualityAssignments(Dictionary<string, HDRenderPipelineAsset> assets) {
    foreach (var name in Names) {
      var index = Array.IndexOf(QualitySettings.names, name);
      if (index < 0) {
        Debug.LogWarning(
            $"Quality level '{name}' must be created by Unity before pipeline assignment.");
        continue;
      }
      QualitySettings.SetQualityLevel(index, false);
      QualitySettings.renderPipeline = assets[name];
    }
    var high = Array.IndexOf(QualitySettings.names, "High");
    if (high >= 0)
      QualitySettings.SetQualityLevel(high, true);
  }
  [MenuItem("NWD/HDRP/Validate Quality Profiles")]
  public static void ValidateQualityProfiles() {
    var doc = ReadAndValidate();
    var manifest = File.ReadAllText("Packages/manifest.json");
    if (manifest.Contains("render-pipelines.universal"))
      throw new InvalidDataException("URP dependency remains");
    if (!manifest.Contains("render-pipelines.high-definition"))
      throw new InvalidDataException("HDRP dependency missing");
    foreach (var name in Names)
      if (!AssetDatabase.LoadAssetAtPath<HDRenderPipelineAsset>(
              $"{Output}/NWD HDRP {name}.asset"))
        throw new InvalidDataException("Missing HDRP asset: " + name);
    if (GraphicsSettings.defaultRenderPipeline !=
        AssetDatabase.LoadAssetAtPath<HDRenderPipelineAsset>(
            $"{Output}/NWD HDRP High.asset"))
      throw new InvalidDataException("High is not the default render pipeline");
    Debug.Log(
        $"Validated {Names.Length} HDRP quality profiles at {doc.baseline.resolution.width}x{doc.baseline.resolution.height} / {doc.baseline.targetFps} FPS.");
  }
}

public sealed class AppliedHdrpConfiguration : ScriptableObject {
  public string jsonHash, unityVersion, hdrpVersion, appliedUtc, defaultProfile;
  public List<string> appliedProperties = new List<string>();
  public List<string> unsupportedProperties = new List<string>();
  public bool valid;
}
}
