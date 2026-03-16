import Phaser from 'phaser';
import { PartyHudMember } from './sceneShared';
import { controlManager } from '../input/ControlManager';
import { getWeaponCatalogEntry } from '../config/weaponCatalog';

interface ProtagonistHud {
  container: Phaser.GameObjects.Container;
  nameText: Phaser.GameObjects.Text;
  hpFill: Phaser.GameObjects.Rectangle;
  activeWeaponText: Phaser.GameObjects.Text;
  secondaryWeaponText: Phaser.GameObjects.Text;
  ammoText: Phaser.GameObjects.Text;
  statusText: Phaser.GameObjects.Text;
}

type CombatHudStatusTone = 'normal' | 'reload' | 'switch' | 'empty';

export class UIScene extends Phaser.Scene {
  private protagonistHud?: ProtagonistHud;
  private previousProtagonistHud?: PartyHudMember;
  private combatStatusClearTimer?: Phaser.Time.TimerEvent;
  private zombieCountText?: Phaser.GameObjects.Text;
  private objectiveText?: Phaser.GameObjects.Text;
  private interactionText?: Phaser.GameObjects.Text;
  private dialoguePanel?: Phaser.GameObjects.Container;
  private dialogueSpeakerText?: Phaser.GameObjects.Text;
  private dialogueBodyText?: Phaser.GameObjects.Text;
  private dialogueHintText?: Phaser.GameObjects.Text;
  private controlsLegendText?: Phaser.GameObjects.Text;

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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-partyHud', this.handlePartyHudChanged, this);
      this.registry.events.off('changedata-zombiesRemaining', this.handleZombiesChanged, this);
      this.registry.events.off('changedata-currentObjective', this.handleObjectiveChanged, this);
      this.registry.events.off('changedata-isGamePaused', this.handlePauseStateChanged, this);
      this.registry.events.off('changedata-interactionHint', this.handleInteractionHintChanged, this);
      this.registry.events.off('changedata-dialogueState', this.handleDialogueStateChanged, this);
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
  }

  private handlePartyHudChanged(_parent: Phaser.Data.DataManager, value: PartyHudMember[]): void {
    const members = Array.isArray(value) ? value : [];

    const protagonist = members.find((member) => member.role === 'protagonist') ?? members[0];
    if (!protagonist || !this.protagonistHud) {
      this.protagonistHud?.container.setVisible(false);
      return;
    }

    const hp = Phaser.Math.Clamp(Math.round(protagonist.health), 0, Math.max(1, protagonist.maxHealth));
    const maxHp = Math.max(1, Math.round(protagonist.maxHealth));
    const hpRatio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    const activeWeaponText = this.getWeaponDisplayLabel(protagonist.activeWeapon);
    const secondaryWeaponText = protagonist.secondaryWeapon
      ? this.getWeaponDisplayLabel(protagonist.secondaryWeapon)
      : 'Sin secundaria';
    const activeWeaponCatalog = getWeaponCatalogEntry(protagonist.activeWeapon);
    const isTrayShield = protagonist.activeWeapon === 'tray_shield';
    const specialStateText = isTrayShield
      ? 'ESCUDO ACTIVO'
      : activeWeaponCatalog.isMelee
        ? 'MODO MELEE'
        : '';
    const ammoText = this.getAmmoDisplayText(protagonist);
    const prev = this.previousProtagonistHud;
    const startedReload = !prev?.isReloading && Boolean(protagonist.isReloading);
    const switchedWeapon = prev?.activeWeapon !== undefined && prev.activeWeapon !== protagonist.activeWeapon;
    const justReachedEmpty = protagonist.usesAmmo
      && (protagonist.ammoCurrent ?? 0) <= 0
      && (protagonist.ammoReserve ?? 0) <= 0
      && ((prev?.ammoCurrent ?? 0) > 0 || (prev?.ammoReserve ?? 0) > 0);
    const shouldClearStatus = !protagonist.isReloading && !specialStateText;

    this.protagonistHud.nameText.setText(`[${protagonist.name.toUpperCase()}]`);
    this.protagonistHud.hpFill.setSize(122 * hpRatio, 8);
    this.protagonistHud.activeWeaponText.setText(`Activa: ${activeWeaponText}`);
    this.protagonistHud.secondaryWeaponText.setText(`Sec.: ${secondaryWeaponText}`);
    this.protagonistHud.ammoText.setText(ammoText);

    if (startedReload) {
      this.showCombatStatus('RECARGANDO...', 'reload', 850);
    } else if (switchedWeapon) {
      this.showCombatStatus(`ARMA: ${activeWeaponText}`, 'switch', 850);
    } else if (justReachedEmpty) {
      this.showCombatStatus('SIN MUNICIÓN', 'empty', 1000);
    } else if (protagonist.isReloading) {
      this.showCombatStatus('RECARGANDO...', 'reload', 220);
    } else if (specialStateText) {
      this.showCombatStatus(specialStateText, isTrayShield ? 'switch' : 'normal', 220);
    } else if (shouldClearStatus) {
      this.showCombatStatus('', 'normal', 0);
    }

    this.protagonistHud.container.setVisible(true);
    this.previousProtagonistHud = {
      ...protagonist
    };
  }

  private getWeaponDisplayLabel(weaponKey?: string): string {
    if (!weaponKey) {
      return '—';
    }

    return getWeaponCatalogEntry(weaponKey).displayName;
  }

  private getAmmoDisplayText(member: PartyHudMember): string {
    if (!member.usesAmmo) {
      return 'Munición: —';
    }

    const current = Math.max(0, member.ammoCurrent ?? 0);
    const reserve = Math.max(0, member.ammoReserve ?? 0);
    const ammoType = member.ammoType ? ` ${member.ammoType}` : '';
    return `Munición: ${current} / ${reserve}${ammoType}`;
  }

  private showCombatStatus(message: string, tone: CombatHudStatusTone, durationMs: number): void {
    if (!this.protagonistHud) {
      return;
    }

    this.combatStatusClearTimer?.remove(false);

    const statusText = this.protagonistHud.statusText;
    if (!message) {
      statusText.setText('').setVisible(false);
      return;
    }

    const colorByTone: Record<CombatHudStatusTone, string> = {
      normal: '#cbd5e1',
      reload: '#93c5fd',
      switch: '#fde68a',
      empty: '#fca5a5'
    };

    statusText
      .setColor(colorByTone[tone])
      .setText(message)
      .setVisible(true);

    if (durationMs > 0) {
      this.combatStatusClearTimer = this.time.delayedCall(durationMs, () => {
        statusText.setText('').setVisible(false);
      });
    }
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
    this.protagonistHud?.container.setAlpha(isPaused ? 0.65 : 1);
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

  private getControlsLegendText(): string {
    return [
      `${controlManager.getMovementDisplayLabel()}` ,
      `${controlManager.getDisplayLabel('jump')} saltar`,
      `${controlManager.getDisplayLabel('shoot')} disparar`,
      `${controlManager.getDisplayLabel('reload')} recargar`,
      `${controlManager.getDisplayLabel('interact')} interactuar`,
      `${controlManager.getDisplayLabel('pause')} pausa`,
      `${controlManager.getDisplayLabel('quit')} salir`
    ].join(' · ');
  }

  private createHudFrame(): void {
    const pixelFont = '"Courier New", monospace';

    const nameText = this.add.text(16, 14, '', {
      color: '#f8fafc',
      fontSize: '12px',
      fontFamily: pixelFont,
      fontStyle: 'bold'
    }).setScrollFactor(0);

    const hpBg = this.add.rectangle(16, 30, 122, 8, 0x1f2937, 0.95)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0x334155, 1);

    const hpFill = this.add.rectangle(16, 30, 0, 8, 0x38bdf8, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0);

    const activeWeaponText = this.add.text(16, 44, '', {
      color: '#e2e8f0',
      fontSize: '11px',
      fontFamily: pixelFont
    }).setScrollFactor(0);

    const secondaryWeaponText = this.add.text(16, 58, '', {
      color: '#cbd5e1',
      fontSize: '11px',
      fontFamily: pixelFont
    }).setScrollFactor(0);

    const ammoText = this.add.text(16, 72, '', {
      color: '#f8fafc',
      fontSize: '11px',
      fontFamily: pixelFont,
      fontStyle: 'bold'
    }).setScrollFactor(0);

    const statusText = this.add.text(16, 86, '', {
      color: '#cbd5e1',
      fontSize: '10px',
      fontFamily: pixelFont,
      fontStyle: 'bold'
    }).setScrollFactor(0).setVisible(false);

    this.protagonistHud = {
      container: this.add.container(0, 0, [nameText, hpBg, hpFill, activeWeaponText, secondaryWeaponText, ammoText, statusText]).setVisible(false),
      nameText,
      hpFill,
      activeWeaponText,
      secondaryWeaponText,
      ammoText,
      statusText
    };

    this.zombieCountText = this.add.text(18, 106, '', {
      color: '#fca5a5',
      fontSize: '12px',
      fontFamily: pixelFont
    }).setScrollFactor(0);

    this.objectiveText = this.add.text(this.scale.width / 2, this.scale.height - 18, '', {
      color: '#fde047',
      fontSize: '13px',
      fontFamily: pixelFont,
      backgroundColor: '#0f172a',
      padding: { x: 10, y: 4 },
      wordWrap: { width: Math.min(this.scale.width - 44, 700) },
      align: 'center'
    })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(9)
      .setAlpha(0.96);

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

    this.controlsLegendText = this.add.text(this.scale.width - 12, 12, this.getControlsLegendText(), {
      color: '#cbd5e1',
      fontSize: '11px',
      fontFamily: pixelFont,
      backgroundColor: '#0f172a',
      padding: { x: 6, y: 4 }
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(12).setAlpha(0.9);

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
  }
}
