using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.Build;
using UnityEngine;

namespace NWD.Build {
public static class WindowsDevelopmentBuilder {
  const string Output = "Builds/WindowsDevelopment/NoWayDown.exe";
  [MenuItem("NWD/Build/Windows x64 Development")]
  public static void Build() {
    EditorTools.ProjectSetupCoordinator.Validate();
    var scenes = EditorBuildSettings.scenes.Where(s => s.enabled)
        .Select(s => s.path).ToList();
    const string benchmark = "Assets/NWD/Scenes/Benchmark/VisualBenchmark.unity";
    if (!File.Exists(benchmark)) throw new InvalidOperationException("Benchmark scene was not generated.");
    if (!scenes.Contains(benchmark)) scenes.Add(benchmark);
    Directory.CreateDirectory(Path.GetDirectoryName(Output));
    EditorUserBuildSettings.development = true;
    EditorUserBuildSettings.SetPlatformSettings("Standalone", "Architecture", "x64");
    var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
      scenes = scenes.ToArray(), locationPathName = Output,
      target = BuildTarget.StandaloneWindows64,
      options = BuildOptions.Development | BuildOptions.AllowDebugging
    });
    File.WriteAllText("Builds/WindowsDevelopment/build-report.txt",
      $"result={report.summary.result}\nerrors={report.summary.totalErrors}\n" +
      $"warnings={report.summary.totalWarnings}\nsize={report.summary.totalSize}\n");
    if (report.summary.result != BuildResult.Succeeded)
      throw new BuildFailedException("Windows Development build failed: " + report.summary.result);
    Debug.Log("Windows x64 Development build created at " + Output);
  }
}
}
