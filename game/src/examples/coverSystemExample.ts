import Phaser from 'phaser';
import { CoverSystem, CoverSystemJsonConfig } from '../systems/CoverSystem';

const coverConfigJson: CoverSystemJsonConfig = {
  objects: [
    {
      id: 'columna-norte-1',
      type: 'column',
      x: 340,
      y: 120,
      width: 48,
      height: 48,
      damageReduction: 0.45,
      firePenalty: 0.2
    },
    {
      id: 'baranda-central',
      type: 'railing',
      x: 520,
      y: 160,
      width: 220,
      height: 24,
      damageReduction: 0.3,
      firePenalty: 0.1
    },
    {
      id: 'mueble-oficina',
      type: 'furniture',
      x: 780,
      y: 140,
      width: 96,
      height: 56,
      damageReduction: 0.55,
      firePenalty: 0.3
    }
  ],
  rules: {
    detectionPadding: 8,
    maxShootDistanceFromCover: 46,
    minDamageMultiplier: 0.25
  }
};

const coverSystem = CoverSystem.fromJSON(coverConfigJson);

const shooter = new Phaser.Math.Vector2(352, 148);
const target = new Phaser.Math.Vector2(920, 152);
const zombie = new Phaser.Math.Vector2(1000, 152);

const canShoot = coverSystem.canShootFromBehindCover(shooter, target);
const blockedDamage = coverSystem.applyIncomingDamage(zombie, shooter, 20);

console.log({
  canShoot,
  blockedDamage,
  coverAtShooter: coverSystem.getCoverAt(shooter.x, shooter.y)?.id ?? null
});
