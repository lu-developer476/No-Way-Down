using System.Collections;
using UnityEngine.SceneManagement;
namespace NWD.Application {
public sealed class SceneLoadingService {
  public IEnumerator LoadAdditive(string path) {
    if (SceneManager.GetSceneByPath(path).isLoaded)
      yield break;
    var operation = SceneManager.LoadSceneAsync(path, LoadSceneMode.Additive);
    if (operation == null)
      throw new System.InvalidOperationException(
          "Scene is not in Build Settings: " + path);
    while (!operation.isDone)
      yield return null;
  }
  public IEnumerator Unload(string path) {
    var scene = SceneManager.GetSceneByPath(path);
    if (!scene.isLoaded)
      yield break;
    var operation = SceneManager.UnloadSceneAsync(scene);
    while (operation != null && !operation.isDone)
      yield return null;
  }
}
}
