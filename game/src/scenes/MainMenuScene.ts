import Phaser from 'phaser';
import { CampaignFlow } from './CampaignFlow';
import { inactiveMainMenuState, initialMainMenuState, type MainMenuState } from './mainMenuState';

export class MainMenuScene extends Phaser.Scene {
  private menuState: MainMenuState = initialMainMenuState();

  constructor() { super('MainMenuScene'); }

  create(): void {
    this.menuState = initialMainMenuState();
    this.registry.set('mainMenuState', this.menuState);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.publishInactiveState, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.publishInactiveState, this);
    const { width, height } = this.scale;
    this.add.image(width / 2, height / 2, 'nwd-menu').setDisplaySize(width, height);
    const start = this.add.text(width / 2, height * .82, 'NUEVA PARTIDA', {
      fontFamily: 'monospace', fontSize: '24px', color: '#ffffff', backgroundColor: '#111827', padding: { x: 20, y: 10 },
    }).setOrigin(.5).setInteractive({ useHandCursor: true });
    const run = (): void => new CampaignFlow(this).start();
    start.on('pointerdown', run);
    this.input.keyboard?.once('keydown-ENTER', run);
  }

  private publishInactiveState(): void {
    this.menuState = inactiveMainMenuState(this.menuState);
    this.registry.set('mainMenuState', this.menuState);
  }
}
