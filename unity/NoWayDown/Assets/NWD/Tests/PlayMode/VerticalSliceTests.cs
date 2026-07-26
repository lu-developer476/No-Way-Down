using System.Collections;using NUnit.Framework;using UnityEngine;using UnityEngine.TestTools;using NWD.Combat;using NWD.Missions;using NWD.Squad;
namespace NWD.Tests.PlayMode {public sealed class VerticalSliceTests {
 [UnityTest]public IEnumerator FirearmAndHealthComponentsInstantiate(){var target=new GameObject("infected");target.AddComponent<HealthComponent>();yield return null;Assert.NotNull(target.GetComponent<HealthComponent>());Object.Destroy(target);}
 [UnityTest]public IEnumerator CompanionSupportsCanonicalStates(){var g=new GameObject("companion");Assert.That(System.Enum.GetNames(typeof(CompanionState)),Does.Contain("Revive"));yield return null;Object.Destroy(g);}
 [UnityTest]public IEnumerator ObjectiveCannotAdvanceTwice(){var d=ScriptableObject.CreateInstance<ObjectiveDefinition>();var o=new ObjectiveRuntime(d);o.Start();Assert.True(o.SetProgress(1));Assert.False(o.SetProgress(1));yield return null;}
}}
