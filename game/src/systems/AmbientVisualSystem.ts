import Phaser from 'phaser';
import { visualTheme } from '../scenes/visualTheme';

export interface AmbientZoneDefinition {
  id: string;
  zone: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AmbientVisualSystemConfig {
  levelWidth: number;
  levelHeight: number;
  floorTop: number;
  zones: AmbientZoneDefinition[];
}

interface AmbientDustRuntime {
  image: Phaser.GameObjects.Image;
  baseX: number;
  baseY: number;
  phase: number;
  amplitudeX: number;
  amplitudeY: number;
}

interface AmbientLightRuntime {
  image: Phaser.GameObjects.Image;
  halo: Phaser.GameObjects.Ellipse;
  baseAlpha: number;
  phase: number;
}

interface AmbientCableRuntime {
  image: Phaser.GameObjects.Image;
  baseAngle: number;
  phase: number;
}

interface AmbientSteamRuntime {
  image: Phaser.GameObjects.Image;
  baseX: number;
  baseY: number;
  phase: number;
  duration: number;
}

interface AmbientDropRuntime {
  image: Phaser.GameObjects.Image;
  baseX: number;
  topY: number;
  bottomY: number;
  phase: number;
  duration: number;
}

interface AmbientScreenRuntime {
  scanline: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Rectangle;
  centerX: number;
  topY: number;
  height: number;
  phase: number;
}

export class AmbientVisualSystem {
  private readonly permanentObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly dustMotes: AmbientDustRuntime[] = [];
  private readonly emergencyLights: AmbientLightRuntime[] = [];
  private readonly hangingCables: AmbientCableRuntime[] = [];
  private readonly steamPuffs: AmbientSteamRuntime[] = [];
  private readonly waterDrops: AmbientDropRuntime[] = [];
  private readonly screens: AmbientScreenRuntime[] = [];
  private steamSourceCount = 0;
  private screenCount = 0;
  private pipeCount = 0;
  private ventCount = 0;
  private exitSignCount = 0;
  private lightCount = 0;
  private cableCount = 0;
  private created = false;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: AmbientVisualSystemConfig
  ) {}

  create(): void {
    if (this.created || this.destroyed) {
      return;
    }
    this.created = true;
    this.getZones().forEach((zone, zoneIndex) => {
      this.createZoneArchitecture(zone, zoneIndex);
    });
    this.createFloorDebris();
    this.createDustMotes();
  }

  private getZones(): AmbientZoneDefinition[] {
    if (this.config.zones.length > 0) {
      return this.config.zones;
    }
    return [{
      id: 'ambient-fallback',
      zone: 'servicios_comedor_cocina',
      x: 0,
      y: 0,
      width: this.config.levelWidth,
      height: this.config.floorTop
    }];
  }

  private createZoneArchitecture(zone: AmbientZoneDefinition, zoneIndex: number): void {
    const service = zone.zone === 'servicios_comedor_cocina';
    const parking = zone.zone === 'subsuelo_estacionamiento';
    const circulation = zone.zone === 'circulacion_vertical';
    const hall = zone.zone === 'hall_publico';
    const office = zone.zone === 'pisos_oficina';
    const industrial = service || parking;

    const pipeTarget = industrial ? 2 : circulation || hall ? 0 : 1;
    for (let index = 0; index < pipeTarget && this.pipeCount < 14; index += 1) {
      const x = zone.x + 130 + index * Math.max(360, Math.floor(zone.width / 2));
      if (x >= zone.x + zone.width - 35) break;
      const pipe = this.scene.add.image(x, 54 + (zoneIndex % 2) * 22, 'ambient-ceiling-pipe')
        .setDepth(1.9 + (index % 3) * 0.1)
        .setScrollFactor(0.58 + ((zoneIndex + index) % 3) * 0.07, 1)
        .setAlpha(0.55 + ((zoneIndex + index) % 4) * 0.07)
        .setScale(0.9 + ((zoneIndex + index) % 4) * 0.06)
        .setFlipX(index % 2 === 1);
      this.permanentObjects.push(pipe);
      this.pipeCount += 1;
    }

    const ventTarget = industrial ? 2 : (hall || office ? 1 : 0);
    for (let index = 0; index < ventTarget && this.ventCount < 10; index += 1) {
      const x = zone.x + zone.width * (index + 1) / (ventTarget + 1);
      const vent = this.scene.add.image(x, 110 + ((zoneIndex * 23 + index * 31) % 61), 'ambient-wall-vent')
        .setDepth(2.25).setScrollFactor(0.66, 1)
        .setAlpha(0.62 + ((zoneIndex + index) % 4) * 0.06)
        .setScale(0.82 + ((zoneIndex + index) % 3) * 0.09);
      this.permanentObjects.push(vent);
      this.ventCount += 1;
    }

    if ((circulation || hall || office) && this.exitSignCount < 6) {
      const x = zone.x + Math.max(60, zone.width - 82);
      const halo = this.scene.add.rectangle(x, 105, 62, 12, 0x7de3a1, 0.04)
        .setDepth(2.6).setScrollFactor(0.8, 1).setBlendMode(Phaser.BlendModes.ADD);
      const sign = this.scene.add.image(x, 98, 'ambient-exit-sign')
        .setDepth(2.7).setScrollFactor(0.74 + (zoneIndex % 3) * 0.06, 1)
        .setAlpha(0.9).setScale(0.85 + (zoneIndex % 3) * 0.075);
      this.permanentObjects.push(halo, sign);
      this.exitSignCount += 1;
    }

    if ((industrial || circulation || hall || office) && this.lightCount < 8) {
      const x = zone.x + Math.min(zone.width - 45, 90 + (zoneIndex % 3) * 54);
      const color = parking
        ? visualTheme.palette.worldColdLight
        : hall ? visualTheme.palette.worldWarmLight : visualTheme.palette.worldDangerGlow;
      const halo = this.scene.add.ellipse(x, 137, 52, 18, color, 0.08)
        .setDepth(2.9).setScrollFactor(0.76, 1).setBlendMode(Phaser.BlendModes.ADD);
      const image = this.scene.add.image(x, 134, 'ambient-emergency-lamp')
        .setDepth(3).setScrollFactor(0.76, 1).setAlpha(0.82);
      this.emergencyLights.push({ image, halo, baseAlpha: 0.82, phase: zoneIndex * 937 });
      this.lightCount += 1;
    }

    if ((industrial || circulation) && this.cableCount < 6) {
      const x = zone.x + Math.min(zone.width - 50, 215 + (zoneIndex % 2) * 80);
      const baseAngle = ((zoneIndex % 3) - 1) * 2;
      const image = this.scene.add.image(x, 22, 'ambient-hanging-cable')
        .setOrigin(0.5, 0).setDepth(3.1).setScrollFactor(0.78, 1)
        .setAlpha(0.52 + (zoneIndex % 3) * 0.1).setScale(0.8 + (zoneIndex % 3) * 0.1)
        .setAngle(baseAngle);
      this.hangingCables.push({ image, baseAngle, phase: zoneIndex * 0.83 });
      this.cableCount += 1;
    }

    if ((service || parking) && this.waterDrops.length < 6) {
      this.createDripSource(zone.x + Math.min(zone.width - 55, 310 + (zoneIndex % 2) * 70), 72);
    }
  }

  private createFloorDebris(): void {
    for (let x = 260, index = 0; x < this.config.levelWidth - 80 && index < 14; x += 430, index += 1) {
      const paper = this.scene.add.image(x, this.config.floorTop - 3, index % 2 === 0 ? 'ambient-paper-a' : 'ambient-paper-b')
        .setDepth(5.25 + (index % 3) * 0.1).setAlpha(0.58 + (index % 4) * 0.06)
        .setScale(0.8 + (index % 3) * 0.1).setAngle(-12 + (index * 9) % 25);
      this.permanentObjects.push(paper);
    }
  }

  private createDustMotes(): void {
    const verticalRange = Math.max(1, this.config.floorTop - 150);
    for (let x = 160, index = 0; x < this.config.levelWidth - 60 && index < 18; x += 340, index += 1) {
      const baseY = 80 + ((index * 67) % verticalRange);
      const image = this.scene.add.image(x, baseY, 'ambient-dust-mote')
        .setDepth(3.2 + (index % 6) * 0.1).setScrollFactor(0.78 + (index % 4) * 0.04, 1)
        .setAlpha(0.06 + (index % 4) * 0.025);
      this.dustMotes.push({ image, baseX: x, baseY, phase: index * 0.71, amplitudeX: 3 + index % 5, amplitudeY: 4 + index % 4 });
    }
  }

  private createDripSource(x: number, topY: number): void {
    for (let index = 0; index < 2 && this.waterDrops.length < 6; index += 1) {
      const dropIndex = this.waterDrops.length;
      const image = this.scene.add.image(x + index * 3, topY, 'ambient-water-drop')
        .setDepth(4.8).setAlpha(0);
      this.waterDrops.push({
        image, baseX: x + index * 3, topY, bottomY: this.config.floorTop - 2,
        phase: dropIndex * 487, duration: 1300 + (dropIndex % 4) * 200
      });
    }
  }

  registerSteamSource(x: number, y: number): void {
    if (this.destroyed || this.steamSourceCount >= 4) return;
    const sourceIndex = this.steamSourceCount;
    [1800, 2100, 2400].forEach((duration, index) => {
      const image = this.scene.add.image(x, y, 'ambient-steam-puff')
        .setDepth(7).setAlpha(0).setScale(0.65 + index * 0.1);
      this.steamPuffs.push({ image, baseX: x, baseY: y, phase: sourceIndex * 431 + index * 613, duration });
    });
    this.steamSourceCount += 1;
  }

  registerScreen(centerX: number, centerY: number, width = 28, height = 18): void {
    if (this.destroyed || this.screenCount >= 8) return;
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const glow = this.scene.add.rectangle(centerX, centerY, safeWidth, safeHeight, visualTheme.palette.worldColdLight, 0.025 + (this.screenCount % 4) * 0.01)
      .setDepth(6.15).setBlendMode(Phaser.BlendModes.ADD);
    const scanline = this.scene.add.image(centerX, centerY - safeHeight / 2, 'ambient-screen-scanline')
      .setDepth(6.25).setAlpha(0.12).setDisplaySize(Math.min(28, safeWidth), Math.min(4, safeHeight));
    this.screens.push({ scanline, glow, centerX, topY: centerY - safeHeight / 2, height: safeHeight, phase: this.screenCount * 347 });
    this.screenCount += 1;
  }

  update(time: number): void {
    if (this.destroyed || !this.created || !this.scene.sys.isActive()) return;
    const seconds = time / 1000;
    this.dustMotes.forEach((runtime) => {
      const wave = seconds + runtime.phase;
      runtime.image.setPosition(runtime.baseX + Math.sin(wave * 0.55) * runtime.amplitudeX, runtime.baseY + Math.cos(wave * 0.38) * runtime.amplitudeY);
      runtime.image.setAlpha(0.1025 + Math.sin(wave * 0.72) * 0.0575);
    });
    this.hangingCables.forEach((runtime) => runtime.image.setAngle(runtime.baseAngle + Math.sin(time / 1900 + runtime.phase) * 1.5));
    this.emergencyLights.forEach((runtime) => {
      const cycle = (time + runtime.phase) % 5200;
      const flicker = cycle > 4940 ? 0.28 + Math.abs(Math.sin((cycle - 4940) / 28)) * 0.72 : runtime.baseAlpha;
      runtime.image.setAlpha(Math.min(1, Math.max(0.28, flicker)));
      runtime.halo.setAlpha(Math.min(0.11, 0.045 + flicker * 0.065));
    });
    this.steamPuffs.forEach((runtime) => {
      const progress = ((time + runtime.phase) % runtime.duration) / runtime.duration;
      runtime.image.setPosition(runtime.baseX + Math.sin(progress * Math.PI * 2) * 7, runtime.baseY - progress * 46)
        .setScale(0.68 + progress * 0.7).setAlpha(Math.sin(Math.PI * progress) * 0.19);
    });
    this.waterDrops.forEach((runtime) => {
      const progress = ((time + runtime.phase) % runtime.duration) / runtime.duration;
      const alpha = progress < 0.05 || progress > 0.9 ? 0 : Math.min(0.72, (progress - 0.05) * 4);
      runtime.image.setPosition(runtime.baseX, runtime.topY + (runtime.bottomY - runtime.topY) * progress)
        .setAlpha(alpha).setScale(0.75 + progress * 0.25);
    });
    this.screens.forEach((runtime, index) => {
      const duration = 1600 + (index % 4) * 200;
      const progress = ((time + runtime.phase) % duration) / duration;
      runtime.scanline.setPosition(runtime.centerX, runtime.topY + runtime.height * progress)
        .setAlpha(0.15 + Math.sin(progress * Math.PI * 2) * 0.07);
      runtime.glow.setAlpha(0.04 + Math.sin(time / 1250 + runtime.phase) * 0.015);
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const objects = new Set<Phaser.GameObjects.GameObject>(this.permanentObjects);
    this.dustMotes.forEach(({ image }) => objects.add(image));
    this.emergencyLights.forEach(({ image, halo }) => { objects.add(image); objects.add(halo); });
    this.hangingCables.forEach(({ image }) => objects.add(image));
    this.steamPuffs.forEach(({ image }) => objects.add(image));
    this.waterDrops.forEach(({ image }) => objects.add(image));
    this.screens.forEach(({ scanline, glow }) => { objects.add(scanline); objects.add(glow); });
    objects.forEach((object) => this.destroyObject(object));
    this.permanentObjects.length = 0;
    this.dustMotes.length = 0;
    this.emergencyLights.length = 0;
    this.hangingCables.length = 0;
    this.steamPuffs.length = 0;
    this.waterDrops.length = 0;
    this.screens.length = 0;
  }

  private destroyObject(object: Phaser.GameObjects.GameObject): void {
    if (object.scene) object.destroy();
  }
}
