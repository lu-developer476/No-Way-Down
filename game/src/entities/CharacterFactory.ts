import Phaser from 'phaser';
import { CharacterStats } from './Character';
import { CHARACTERS, CharacterId } from './CharacterRegistry';
import { Survivor } from './Survivor';

const DEFAULT_TEXTURE_KEY = 'missing-character-sheet';

export class CharacterFactory {
  hasCharacter(characterId: string): characterId is CharacterId {
    return characterId in CHARACTERS;
  }

  getCharacterConfig(characterId: CharacterId) {
    return CHARACTERS[characterId];
  }

  create(scene: Phaser.Scene, characterId: CharacterId, x: number, y: number): Survivor {
    const config = this.getCharacterConfig(characterId);

    if (!config) {
      throw new Error(`Character with id "${characterId}" is not registered.`);
    }

    const stats: CharacterStats = {
      name: config.name,
      maxHealth: config.health,
      weaponType: config.weapon,
      fireRate: config.fireRate,
      damage: config.damage,
      moveSpeed: config.speed
    };

    const textureKey = config.textureKey ?? DEFAULT_TEXTURE_KEY;
    if (!scene.textures.exists(textureKey)) {
      console.error(`[CharacterFactory] Missing texture "${textureKey}" for character "${characterId}". Using explicit missing-character sheet.`);
    }

    return new Survivor(scene, characterId, x, y, scene.textures.exists(textureKey) ? textureKey : DEFAULT_TEXTURE_KEY, 0, stats);
  }
}
