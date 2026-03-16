import Phaser from 'phaser';
import { Character } from '../entities/Character';
import { CHARACTERS, CharacterId } from '../entities/CharacterRegistry';

const NAME_TAG_OFFSET_Y = 40;

export class NameTag {
  private readonly text: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene, private readonly character: Character) {
    const name = this.resolveCharacterName();

    this.text = this.scene.add
      .text(this.character.x, this.character.y - NAME_TAG_OFFSET_Y, name, {
        color: '#00ff00',
        fontSize: '14px'
      })
      .setOrigin(0.5, 1)
      .setDepth(1000);

    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.character.once(Phaser.GameObjects.Events.DESTROY, this.destroy, this);
    this.text.once(Phaser.GameObjects.Events.DESTROY, this.onTextDestroyed, this);
  }

  private resolveCharacterName(): string {
    const registryCharacter = CHARACTERS[this.character.id as CharacterId];
    return registryCharacter?.name ?? this.character.name;
  }

  private update(): void {
    if (!this.character.active) {
      this.text.setVisible(false);
      return;
    }

    this.text.setVisible(true);
    this.text.setPosition(this.character.x, this.character.y - NAME_TAG_OFFSET_Y);
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);

    if (this.text.active) {
      this.text.destroy();
    }
  }

  private onTextDestroyed(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
  }
}
