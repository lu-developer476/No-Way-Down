using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
namespace NWD.Benchmark {
public sealed class BenchmarkMetricsOverlay : MonoBehaviour {
  float elapsed;
  int frames;
  float fps;
  void Update() {
    elapsed += Time.unscaledDeltaTime;
    frames++;
    if (elapsed >= .5f) {
      fps = frames / elapsed;
      elapsed = 0;
      frames = 0;
    }
  }
  void OnGUI() {
    if (!Debug.isDebugBuild)
      return;
    var pipeline = GraphicsSettings.currentRenderPipeline;
    var text =
        $"FPS: {fps:F1}\nFrame: {(fps>0?1000/fps:0):F2} ms\nResolution: {Screen.width} x {Screen.height}\nQuality: {QualitySettings.names[QualitySettings.GetQualityLevel()]}\nLights: {FindObjectsByType<Light>(FindObjectsSortMode.None).Length}\nDraw calls / triangles: profiler API unavailable\nScene: {SceneManager.GetActiveScene().name}\nPipeline: {(pipeline?pipeline.name:"Built-in")}";
    GUI.Box(new Rect(12, 12, 360, 180), text);
  }
}
}
