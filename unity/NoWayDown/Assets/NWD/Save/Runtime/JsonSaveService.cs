using System.IO;
using UnityEngine;
namespace NWD.Save {
public interface ISaveService {
  SaveGameData Load();
  void Save(SaveGameData data);
}
public sealed class JsonSaveService : ISaveService {
  readonly string path;
  public JsonSaveService(string path) => this.path = path;
  public SaveGameData
  Load() => File.Exists(path)
                ? JsonUtility.FromJson<SaveGameData>(File.ReadAllText(path))
                : null;
  public void Save(SaveGameData data) {
    if (data == null || !data.IsComplete())
      throw new InvalidDataException("Refusing incomplete save");
    var json = JsonUtility.ToJson(data, true);
    if (!JsonUtility.FromJson<SaveGameData>(json).IsComplete())
      throw new InvalidDataException("Save validation failed");
    var directory = Path.GetDirectoryName(path);
    if (!string.IsNullOrEmpty(directory))
      Directory.CreateDirectory(directory);
    var temporary = path + ".tmp";
    File.WriteAllText(temporary, json);
    if (File.Exists(path))
      File.Replace(temporary, path, path + ".bak");
    else
      File.Move(temporary, path);
  }
}
}
