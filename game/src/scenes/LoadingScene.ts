import Phaser from 'phaser';
import { visualTheme } from './visualTheme';

const PRELOAD_FILES: Array<{ key: string; path: string }> = [
  { key: 'menu_background', path: 'assets/images/NWD-menu.png' },
  { key: 'characters_panel', path: 'assets/images/NWD-characters.png' },
  { key: 'level2_subsuelo', path: 'assets/levels/level2_subsuelo.json' },
  { key: 'level2_stairs', path: 'assets/levels/level2_stairs.json' },
  { key: 'level2_vertical_spawns', path: 'assets/levels/level2_vertical_spawns.json' },
  { key: 'level2_narrative_call', path: 'assets/levels/level2_narrative_call.json' },
  { key: 'level7_narrative_checkpoints', path: 'assets/levels/level7_narrative_checkpoints.json' }
];


export class LoadingScene extends Phaser.Scene {
  private progressFill?: Phaser.GameObjects.Rectangle;
  private progressLabel?: Phaser.GameObjects.Text;

  constructor() {
    super('LoadingScene');
  }

  preload(): void {
    this.createLoadingLayout();
    this.bindLoaderEvents();

    PRELOAD_FILES.forEach(({ key, path }) => {
      if (path.endsWith('.json')) {
        this.load.json(key, path);
        return;
      }

      this.load.image(key, path);
    });

  }

  create(): void {
    this.scene.start('MainMenuScene');
  }

  private createLoadingLayout(): void {
    const { width, height } = this.scale;
    const barWidth = Math.min(520, width - 120);

    this.add.rectangle(width / 2, height / 2, width, height, visualTheme.palette.skyTop, 1);

    this.add.text(width / 2, height / 2 - 96, 'NO WAY DOWN', {
      color: '#e2e8f0',
      fontSize: '44px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5);

    this.add.rectangle(width / 2, height / 2, barWidth, 28, 0x0b1220, 0.9)
      .setStrokeStyle(2, 0x38bdf8, 1);

    this.progressFill = this.add.rectangle(width / 2 - barWidth / 2 + 4, height / 2, 0, 20, 0x22d3ee, 1)
      .setOrigin(0, 0.5);

    this.progressLabel = this.add.text(width / 2, height / 2 + 44, 'Cargando... 0%', {
      color: '#cbd5e1',
      fontSize: '18px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5);
  }

  private bindLoaderEvents(): void {
    const barWidth = Math.min(520, this.scale.width - 120) - 8;

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      const progress = Phaser.Math.Clamp(value, 0, 1);
      this.progressFill?.setSize(barWidth * progress, 20);
      this.progressLabel?.setText(`Cargando... ${Math.round(progress * 100)}%`);
    });

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.progressLabel?.setText('Carga completa');
    });
  }
}
