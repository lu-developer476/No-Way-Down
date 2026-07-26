using System;
using UnityEngine;
namespace NWD.Player {
[RequireComponent(typeof(Light))]
public sealed class PlayerFlashlight : MonoBehaviour {
  [SerializeField]
  bool startsEnabled = true;
  [SerializeField, Min(0)]
  float intensity = 1200;
  [SerializeField, Min(0)]
  float range = 25;
  [SerializeField, Range(1000, 20000)]
  float temperature = 4300;
  [SerializeField]
  Texture cookie;
  [SerializeField, Min(0)] float toggleCooldown = .15f;
  Light source;
  float nextToggle;
  public bool IsOn => source && source.enabled;
  public event Action<bool> StateChanged;
  void Awake() {
    source = GetComponent<Light>();
    Apply();
    SetEnabled(startsEnabled);
  }
  public void Toggle() {
    if (Time.unscaledTime < nextToggle) return;
    nextToggle = Time.unscaledTime + toggleCooldown;
    SetEnabled(!IsOn);
  }
  public void SetEnabled(bool value) {
    if (!source)
      source = GetComponent<Light>();
    if (source.enabled == value)
      return;
    source.enabled = value;
    StateChanged?.Invoke(value);
  }
  public void ApplyQuality(float multiplier = 1) {
    if (!source)
      source = GetComponent<Light>();
    source.type = LightType.Spot;
    source.intensity = intensity * Mathf.Max(.1f, multiplier);
    source.range = range;
    source.useColorTemperature = true;
    source.colorTemperature = temperature;
    source.cookie = cookie;
    source.shadows = LightShadows.Soft;
  }
  void Apply() => ApplyQuality();
}
}
