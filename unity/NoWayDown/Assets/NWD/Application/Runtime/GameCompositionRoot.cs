using System;
using System.IO;
using NWD.Campaign;
using NWD.Narrative;
using NWD.Networking;
using NWD.Save;
using UnityEngine;
using System.Collections;

namespace NWD.Application {
public sealed class GameCompositionRoot : MonoBehaviour {
  static GameCompositionRoot instance;
  [SerializeField]
  CampaignManifestAsset manifest;
  public static GameCompositionRoot Instance => instance;
  public CampaignDirector Campaign { get; private set; }
  public ISaveService Saves { get; private set; }
  public SceneLoadingService Scenes { get; private set; }
  public GameSession Session { get; private set; }
  public IInputService Input { get; private set; }
  public IAudioService Audio { get; private set; }
  public ISessionGateway SessionGateway { get; private set; }
  public bool IsReady { get; private set; }
  void Awake() {
    if (instance && instance != this) {
      Destroy(gameObject);
      return;
    }
    instance = this;
    DontDestroyOnLoad(gameObject);
    Initialize();
  }
  public void Configure(CampaignManifestAsset value) {
    manifest = value;
    if (Campaign)
      Campaign.Configure(manifest, Saves);
  }
  public void Initialize() {
    if (IsReady)
      return;
    Saves = new JsonSaveService(
        Path.Combine(Application.persistentDataPath, "save.json"));
    Scenes = new SceneLoadingService();
    Session = new GameSession();
    Input = new UnityInputService();
    Audio = new NullAudioService();
    SessionGateway = new OfflineSessionGateway();
    Campaign = GetComponent<CampaignDirector>() ??
               gameObject.AddComponent<CampaignDirector>();
    if (manifest)
      Campaign.Configure(manifest, Saves);
    Campaign.TransitionRequested += OnTransitionRequested;
    IsReady = true;
  }
  void OnTransitionRequested(CampaignNodeDefinition destination,
                             string reason) =>
      StartCoroutine(Transition(destination));
  IEnumerator Transition(CampaignNodeDefinition destination) {
    var previous = Campaign.GetCurrentNode();
    Input.Enabled = false;
    yield return Scenes.LoadAdditive(destination.scenePath);
    if (!Scenes.LastResult.Succeeded) {
      Debug.LogError($"NWD_TRANSITION status={Scenes.LastResult.Status} destination={destination.id} scene={destination.scenePath}");
      Input.Enabled = true;
      yield break;
    }
    var deadline = Time.realtimeSinceStartup + 15;
    while (Campaign.GetCurrentNode() != destination && Time.realtimeSinceStartup < deadline)
      yield return null;
    if (Campaign.GetCurrentNode() != destination) {
      Debug.LogError($"NWD_TRANSITION status=Timeout destination={destination.id} rollback=true");
      yield return Scenes.Unload(destination.scenePath);
      Input.Enabled = true;
      yield break;
    }
    if (previous != null)
      yield return Scenes.Unload(previous.scenePath);
    Input.Enabled = true;
  }
  void OnDestroy() {
    if (instance == this) {
      if (Campaign)
        Campaign.TransitionRequested -= OnTransitionRequested;
      SessionGateway?.Shutdown();
      instance = null;
    }
  }
}
public sealed class GameSession {
  public bool IsBenchmark { get; set; }
}
public interface IInputService {
  bool Enabled { get; set; }
}
public sealed class UnityInputService : IInputService {
  public bool Enabled { get; set; } = true;
}
public interface IAudioService {
  void StopAll();
}
public sealed class NullAudioService : IAudioService {
  public void StopAll() {}
}
}
