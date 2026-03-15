import Phaser from 'phaser';
import { PartyHudMember } from './sceneShared';

interface PartyHudRow {
  container: Phaser.GameObjects.Container;
  nameText: Phaser.GameObjects.Text;
  roleText: Phaser.GameObjects.Text;
  hpText: Phaser.GameObjects.Text;
  hpFill: Phaser.GameObjects.Rectangle;
}

export class UIScene extends Phaser.Scene {
  private partyRows: PartyHudRow[] = [];
  private zombieCountText?: Phaser.GameObjects.Text;
  private objectiveText?: Phaser.GameObjects.Text;
  private interactionText?: Phaser.GameObjects.Text;
  private controlsHintText?: Phaser.GameObjects.Text;
  private dialoguePanel?: Phaser.GameObjects.Container;
  private dialogueSpeakerText?: Phaser.GameObjects.Text;
  private dialogueBodyText?: Phaser.GameObjects.Text;
  private dialogueHintText?: Phaser.GameObjects.Text;
  private audioStateText?: Phaser.GameObjects.Text;
  private difficultyText?: Phaser.GameObjects.Text;

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.cameras.main.setRoundPixels(true);
    this.createHudFrame();

    this.registry.events.on('changedata-interactionHint', this.handleInteractionHintChanged, this);
    this.registry.events.on('changedata-partyHud', this.handlePartyHudChanged, this);
    this.registry.events.on('changedata-zombiesRemaining', this.handleZombiesChanged, this);
    this.registry.events.on('changedata-currentObjective', this.handleObjectiveChanged, this);
    this.registry.events.on('changedata-isGamePaused', this.handlePauseStateChanged, this);
    this.registry.events.on('changedata-dialogueState', this.handleDialogueStateChanged, this);
    this.registry.events.on('changedata-audioMuted', this.handleAudioMutedChanged, this);
    this.registry.events.on('changedata-gameDifficultyLabel', this.handleDifficultyChanged, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-partyHud', this.handlePartyHudChanged, this);
      this.registry.events.off('changedata-zombiesRemaining', this.handleZombiesChanged, this);
      this.registry.events.off('changedata-currentObjective', this.handleObjectiveChanged, this);
      this.registry.events.off('changedata-isGamePaused', this.handlePauseStateChanged, this);
      this.registry.events.off('changedata-interactionHint', this.handleInteractionHintChanged, this);
      this.registry.events.off('changedata-dialogueState', this.handleDialogueStateChanged, this);
      this.registry.events.off('changedata-audioMuted', this.handleAudioMutedChanged, this);
      this.registry.events.off('changedata-gameDifficultyLabel', this.handleDifficultyChanged, this);
    });

    this.refreshFromRegistry();
  }

  private refreshFromRegistry(): void {
    this.handlePartyHudChanged(this.registry, this.registry.get('partyHud') ?? []);
    this.handleZombiesChanged(this.registry, this.registry.get('zombiesRemaining') ?? 0);
    this.handleObjectiveChanged(this.registry, this.registry.get('currentObjective') ?? '');
    this.handleInteractionHintChanged(this.registry, this.registry.get('interactionHint') ?? '');
    this.handlePauseStateChanged(this.registry, this.registry.get('isGamePaused') ?? false);
    this.handleDialogueStateChanged(this.registry, this.registry.get('dialogueState') ?? null);
    this.handleAudioMutedChanged(this.registry, this.registry.get('audioMuted') ?? false);
    this.handleDifficultyChanged(this.registry, this.registry.get('gameDifficultyLabel') ?? 'Complejo');
  }

  private handlePartyHudChanged(_parent: Phaser.Data.DataManager, value: PartyHudMember[]): void {
    const members = Array.isArray(value) ? value : [];

    this.partyRows.forEach((row, index) => {
      const member = members[index];
      if (!member) {
        row.container.setVisible(false);
        return;
      }

      const hp = Phaser.Math.Clamp(Math.round(member.health), 0, Math.max(1, member.maxHealth));
      const maxHp = Math.max(1, Math.round(member.maxHealth));
      const hpRatio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
      const roleLabel = member.role === 'protagonist' ? 'CONTROLADO' : 'ALIADO';
      const barColor = member.role === 'protagonist' ? 0x38bdf8 : 0x34d399;

      row.nameText.setText(member.name.toUpperCase());
      row.roleText.setText(roleLabel).setColor(member.role === 'protagonist' ? '#7dd3fc' : '#86efac');
      row.hpText.setText(`${hp}/${maxHp}`);
      row.hpFill.setSize(140 * hpRatio, 8).setFillStyle(barColor, 1);
      row.container.setVisible(true);
    });
  }

  private handleZombiesChanged(_parent: Phaser.Data.DataManager, value: number): void {
    this.zombieCountText?.setText(`Zombies restantes: ${value}`);
  }

  private handleObjectiveChanged(_parent: Phaser.Data.DataManager, value: string): void {
    this.objectiveText?.setText(value ? `OBJETIVO: ${value}` : 'OBJETIVO: ...');
  }

  private handleInteractionHintChanged(_parent: Phaser.Data.DataManager, value: string): void {
    const hint = value?.trim();
    this.interactionText
      ?.setText(hint || '')
      .setVisible(Boolean(hint));
  }

  private handlePauseStateChanged(_parent: Phaser.Data.DataManager, isPaused: boolean): void {
    this.controlsHintText?.setAlpha(isPaused ? 0.4 : 0.8);
  }

  private handleAudioMutedChanged(_parent: Phaser.Data.DataManager, isMuted: boolean): void {
    this.audioStateText?.setText(isMuted ? 'Audio: Muted' : 'Audio: Unmuted');
  }

  private handleDifficultyChanged(_parent: Phaser.Data.DataManager, value: string): void {
    this.difficultyText?.setText(`Dificultad: ${value || 'Complejo'}`);
  }

  private handleDialogueStateChanged(_parent: Phaser.Data.DataManager, value: { speaker: string; text: string; canSkip?: boolean; canAdvance?: boolean } | null): void {
    if (!value || !value.text) {
      this.dialoguePanel?.setVisible(false);
      return;
    }

    this.dialogueSpeakerText?.setText(value.speaker || '...');
    this.dialogueBodyText?.setText(value.text);
    this.dialogueHintText?.setText('SPACE: avanzar · X: saltar diálogo');
    this.dialoguePanel?.setVisible(true);
  }

  private createHudFrame(): void {
    const pixelFont = '"Courier New", monospace';

    this.add.rectangle(188, 98, 344, 164, 0x0b1020, 0.84)
      .setStrokeStyle(3, 0x38bdf8, 0.9)
      .setScrollFactor(0);

    this.add.text(24, 22, 'PARTY', {
      color: '#e2e8f0',
      fontSize: '14px',
      fontFamily: pixelFont,
      fontStyle: 'bold'
    }).setScrollFactor(0);

    for (let i = 0; i < 4; i += 1) {
      const y = 44 + i * 30;
      const nameText = this.add.text(24, y, '', {
        color: '#f8fafc',
        fontSize: '12px',
        fontFamily: pixelFont,
        fontStyle: 'bold'
      }).setScrollFactor(0);

      const roleText = this.add.text(170, y, '', {
        color: '#86efac',
        fontSize: '10px',
        fontFamily: pixelFont
      }).setScrollFactor(0);

      const hpBg = this.add.rectangle(24, y + 14, 140, 8, 0x1f2937, 1)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setStrokeStyle(1, 0x475569, 1);

      const hpFill = this.add.rectangle(24, y + 14, 0, 8, 0x22c55e, 1)
        .setOrigin(0, 0)
        .setScrollFactor(0);

      const hpText = this.add.text(172, y + 11, '', {
        color: '#cbd5e1',
        fontSize: '10px',
        fontFamily: pixelFont
      }).setScrollFactor(0);

      const container = this.add.container(0, 0, [nameText, roleText, hpBg, hpFill, hpText]).setVisible(false);
      this.partyRows.push({ container, nameText, roleText, hpFill, hpText });
    }

    this.zombieCountText = this.add.text(24, 166, '', {
      color: '#fca5a5',
      fontSize: '14px',
      fontFamily: pixelFont
    }).setScrollFactor(0);

    this.objectiveText = this.add.text(24, 190, '', {
      color: '#fde047',
      fontSize: '13px',
      fontFamily: pixelFont,
      wordWrap: { width: 320 }
    }).setScrollFactor(0);

    this.controlsHintText = this.add.text(this.scale.width - 18, this.scale.height - 16, 'Mover A/D · Disparar F · Pausa ESC · Audio M', {
      color: '#93c5fd',
      fontSize: '12px',
      fontFamily: pixelFont,
      backgroundColor: '#0f172a',
      padding: { x: 8, y: 4 }
    })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setAlpha(0.8);

    const dialogueBg = this.add.rectangle(this.scale.width / 2, this.scale.height - 120, Math.min(this.scale.width - 32, 740), 110, 0x020617, 0.92)
      .setStrokeStyle(2, 0x38bdf8, 0.95)
      .setScrollFactor(0);

    this.dialogueSpeakerText = this.add.text(dialogueBg.x - dialogueBg.width / 2 + 16, dialogueBg.y - 42, '', {
      color: '#93c5fd',
      fontSize: '14px',
      fontFamily: pixelFont,
      fontStyle: 'bold'
    }).setOrigin(0, 0.5).setScrollFactor(0);

    this.dialogueBodyText = this.add.text(dialogueBg.x - dialogueBg.width / 2 + 16, dialogueBg.y - 14, '', {
      color: '#e2e8f0',
      fontSize: '14px',
      fontFamily: pixelFont,
      wordWrap: { width: dialogueBg.width - 32 }
    }).setOrigin(0, 0).setScrollFactor(0);

    this.dialogueHintText = this.add.text(dialogueBg.x + dialogueBg.width / 2 - 14, dialogueBg.y + 40, '', {
      color: '#cbd5e1',
      fontSize: '11px',
      fontFamily: pixelFont
    }).setOrigin(1, 0.5).setScrollFactor(0);

    this.dialoguePanel = this.add.container(0, 0, [dialogueBg, this.dialogueSpeakerText, this.dialogueBodyText, this.dialogueHintText])
      .setDepth(50)
      .setVisible(false);

    this.interactionText = this.add.text(this.scale.width / 2, this.scale.height - 48, '', {
      color: '#bbf7d0',
      fontSize: '13px',
      fontFamily: pixelFont,
      backgroundColor: '#052e16',
      padding: { x: 8, y: 4 }
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setVisible(false);

    this.audioStateText = this.add.text(this.scale.width - 14, 18, 'Audio: Unmuted', {
      color: '#93c5fd',
      fontSize: '12px',
      fontFamily: pixelFont,
      backgroundColor: '#0f172a',
      padding: { x: 8, y: 3 }
    })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(52)
      .setAlpha(0.85);

    this.difficultyText = this.add.text(this.scale.width - 14, 42, 'Dificultad: Complejo', {
      color: '#fca5a5',
      fontSize: '12px',
      fontFamily: pixelFont,
      backgroundColor: '#0f172a',
      padding: { x: 8, y: 3 }
    })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(52)
      .setAlpha(0.85);
  }
}
