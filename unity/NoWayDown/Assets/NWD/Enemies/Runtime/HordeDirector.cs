using System.Collections;
using UnityEngine;
namespace NWD.Enemies {
public sealed class HordeDirector : MonoBehaviour {
  public float pressure, noiseAccumulated, difficulty = 1;
  public int alive, activeObjectives;
  public int CalculateBudget() => Mathf.Max(
      0,
      Mathf.FloorToInt((pressure + noiseAccumulated * .5f + activeObjectives) *
                       difficulty) -
          alive);
  public IEnumerator Run(float cooldown) {
    while (enabled)
      yield return new WaitForSeconds(cooldown);
  }
}
public interface IPoolable {
  void OnSpawned();
  void OnDespawned();
}
}
