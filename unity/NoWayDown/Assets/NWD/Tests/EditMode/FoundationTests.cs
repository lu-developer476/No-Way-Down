using System.IO;using System.Linq;using NUnit.Framework;using UnityEngine;using NWD.Narrative;using NWD.Missions;using NWD.Save;using NWD.Combat;using NWD.Enemies;
namespace NWD.Tests.EditMode {public sealed class FoundationTests {
 [Test]public void SourceContainsExactly35OrderedUniqueNodes(){var json=File.ReadAllText("Assets/NWD/Narrative/Source/canonical_campaign_manifest.json");StringAssert.Contains("\"canonicalNodeCount\": 35",json);var ids=JsonUtility.FromJson<Wrapper>(json).nodes.Select(n=>n.id).ToArray();Assert.That(ids,Has.Length.EqualTo(35));Assert.That(ids.Distinct().Count(),Is.EqualTo(35));Assert.That(ids.Take(4),Is.EqualTo(new[]{"campaign-intro","lvl01-esc01-comedor-resistencia","lvl01-esc02-pasillos-hacia-escaleras-pb","lvl01-cin01-cierre-contextual"}));}
 [Test]public void ManifestResolvesNext(){var a=ScriptableObject.CreateInstance<CampaignManifestAsset>();a.nodes.Add(new CampaignNodeDefinition{id="a"});a.nodes.Add(new CampaignNodeDefinition{id="b"});Assert.That(a.Next("a").id,Is.EqualTo("b"));}
 [Test]public void ObjectiveCompletesOnlyOnce(){var d=ScriptableObject.CreateInstance<ObjectiveDefinition>();var o=new ObjectiveRuntime(d);var count=0;o.Completed+=()=>count++;Assert.True(o.Start());Assert.True(o.SetProgress(1));Assert.False(o.SetProgress(1));Assert.That(count,Is.EqualTo(1));}
 [Test]public void SaveRejectsIncompleteData(){var s=new JsonSaveService(Path.Combine(Path.GetTempPath(),"nwd-invalid.json"));Assert.Throws<InvalidDataException>(()=>s.Save(new SaveGameData()));}
 [Test]public void NoiseCarriesRequiredValues(){var e=new NoiseEvent(Vector3.one,.5f,20,2,NoiseCategory.Alarm,null);Assert.That(e.Radius,Is.EqualTo(20));}
 [Test]public void HordeBudgetIsBounded(){var g=new GameObject();var d=g.AddComponent<HordeDirector>();d.pressure=5;d.alive=2;Assert.That(d.CalculateBudget(),Is.EqualTo(3));Object.DestroyImmediate(g);}
 [System.Serializable]sealed class Wrapper{public Node[] nodes;}[System.Serializable]sealed class Node{public string id;}
}}
