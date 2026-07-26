using System;
using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;
namespace NWD.Application {
public enum SceneLoadStatus { Success, SceneAlreadyLoaded, SceneMissing, LoadFailed,
                              UnloadFailed, Timeout, Cancelled }
public readonly struct SceneLoadResult {
  public readonly SceneLoadStatus Status;
  public readonly string Path, Message;
  public bool Succeeded => Status == SceneLoadStatus.Success ||
                           Status == SceneLoadStatus.SceneAlreadyLoaded;
  public SceneLoadResult(SceneLoadStatus status, string path, string message = null) {
    Status = status; Path = path; Message = message;
  }
}
public sealed class SceneLoadingService {
  public SceneLoadResult LastResult { get; private set; }
  public IEnumerator LoadAdditive(string path, float timeoutSeconds = 30,
                                  Func<bool> cancelled = null,
                                  bool makeActive = true) {
    var existing = SceneManager.GetSceneByPath(path);
    if (existing.isLoaded) {
      LastResult = new SceneLoadResult(SceneLoadStatus.SceneAlreadyLoaded, path);
      if (makeActive) SceneManager.SetActiveScene(existing);
      yield break;
    }
    AsyncOperation operation;
    try { operation = SceneManager.LoadSceneAsync(path, LoadSceneMode.Additive); }
    catch (Exception e) {
      LastResult = new SceneLoadResult(SceneLoadStatus.SceneMissing, path, e.Message);
      yield break;
    }
    if (operation == null) {
      LastResult = new SceneLoadResult(SceneLoadStatus.SceneMissing, path,
                                       "Scene is absent from Build Settings");
      yield break;
    }
    var started = Time.realtimeSinceStartup;
    while (!operation.isDone) {
      if (cancelled?.Invoke() == true) {
        LastResult = new SceneLoadResult(SceneLoadStatus.Cancelled, path); yield break;
      }
      if (Time.realtimeSinceStartup - started > timeoutSeconds) {
        LastResult = new SceneLoadResult(SceneLoadStatus.Timeout, path); yield break;
      }
      yield return null;
    }
    var loaded = SceneManager.GetSceneByPath(path);
    if (!loaded.isLoaded) {
      LastResult = new SceneLoadResult(SceneLoadStatus.LoadFailed, path); yield break;
    }
    if (makeActive) SceneManager.SetActiveScene(loaded);
    LastResult = new SceneLoadResult(SceneLoadStatus.Success, path);
  }
  public IEnumerator Unload(string path, float timeoutSeconds = 30) {
    var scene = SceneManager.GetSceneByPath(path);
    if (!scene.isLoaded) {
      LastResult = new SceneLoadResult(SceneLoadStatus.Success, path); yield break;
    }
    var operation = SceneManager.UnloadSceneAsync(scene);
    var started = Time.realtimeSinceStartup;
    while (operation != null && !operation.isDone) {
      if (Time.realtimeSinceStartup - started > timeoutSeconds) {
        LastResult = new SceneLoadResult(SceneLoadStatus.Timeout, path); yield break;
      }
      yield return null;
    }
    LastResult = SceneManager.GetSceneByPath(path).isLoaded
        ? new SceneLoadResult(SceneLoadStatus.UnloadFailed, path)
        : new SceneLoadResult(SceneLoadStatus.Success, path);
  }
}
}
