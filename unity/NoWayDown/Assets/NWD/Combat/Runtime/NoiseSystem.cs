using System;
using UnityEngine;
namespace NWD.Combat {
public enum NoiseCategory {
  Gunshot,
  Melee,
  Sprint,
  BrokenObject,
  Alarm,
  Narrative
}
public readonly struct NoiseEvent {
  public readonly Vector3 Position;
  public readonly float Intensity, Radius, Duration;
  public readonly NoiseCategory Category;
  public readonly GameObject Owner;
  public NoiseEvent(Vector3 p, float i, float r, float d, NoiseCategory c,
                    GameObject o) {
    Position = p;
    Intensity = i;
    Radius = r;
    Duration = d;
    Category = c;
    Owner = o;
  }
}
public static class NoiseSystem {
  public static event Action<NoiseEvent> Emitted;
  public static void Emit(NoiseEvent value) => Emitted?.Invoke(value);
  public static void Clear() => Emitted = null;
  [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
  static void Reset() => Clear();
}
}
