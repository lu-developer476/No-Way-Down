import Phaser from 'phaser';
import { CharacterStats } from './Character';
import { CHARACTERS, CharacterId } from './CharacterRegistry';
import { Survivor } from './Survivor';

const DEFAULT_TEXTURE_KEY = 'alan-sheet';

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

    return new Survivor(scene, characterId, x, y, config.textureKey ?? DEFAULT_TEXTURE_KEY, 0, stats);
  }
}
