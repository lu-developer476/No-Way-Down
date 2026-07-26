using System; using System.Collections.Generic; using UnityEngine;
namespace NWD.Narrative {
 public enum CampaignNodeType { CampaignIntro, Level, Cinematic, CampaignEnding, Unknown }
 public enum ImplementationState { Unimplemented, Greybox, Complete }
 [Serializable] public sealed class CampaignNodeDefinition { public string id; public CampaignNodeType type; public string sceneKey; public string sourceContentPath; public string scenePath; public string timelinePath; public string missionId; public string spawnId; public ImplementationState implementation; }
 [CreateAssetMenu(menuName="NWD/Campaign Manifest")] public sealed class CampaignManifestAsset:ScriptableObject { public string sourceHash; public List<CampaignNodeDefinition> nodes=new(); public CampaignNodeDefinition At(int i)=>i>=0&&i<nodes.Count?nodes[i]:null; public int IndexOf(string id)=>nodes.FindIndex(n=>n.id==id); public CampaignNodeDefinition Next(string id){var i=IndexOf(id); return At(i+1);} }
}
