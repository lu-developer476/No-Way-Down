import Phaser from 'phaser';

export type CoverType = 'column' | 'furniture' | 'railing';

export interface CoverObjectJson {
  id: string;
  type: CoverType;
  x: number;
  y: number;
  width: number;
  height: number;
  damageReduction: number;
  firePenalty?: number;
}

export interface CoverRulesJson {
  detectionPadding: number;
  maxShootDistanceFromCover: number;
  minDamageMultiplier: number;
}

export interface CoverSystemJsonConfig {
  objects: CoverObjectJson[];
  rules?: Partial<CoverRulesJson>;
}

export interface CoverEvaluationResult {
  hasCover: boolean;
  coverId: string | null;
  damageMultiplier: number;
}

const DEFAULT_RULES: CoverRulesJson = {
  detectionPadding: 6,
  maxShootDistanceFromCover: 42,
  minDamageMultiplier: 0.2
};

interface RuntimeCoverObject extends CoverObjectJson {
  rect: Phaser.Geom.Rectangle;
  firePenalty: number;
}

export class CoverSystem {
  private readonly covers: RuntimeCoverObject[];
  private readonly rules: CoverRulesJson;

  constructor(config: CoverSystemJsonConfig) {
    this.rules = {
      detectionPadding: config.rules?.detectionPadding ?? DEFAULT_RULES.detectionPadding,
      maxShootDistanceFromCover: config.rules?.maxShootDistanceFromCover ?? DEFAULT_RULES.maxShootDistanceFromCover,
      minDamageMultiplier: config.rules?.minDamageMultiplier ?? DEFAULT_RULES.minDamageMultiplier
    };

    this.covers = config.objects.map((cover) => ({
      ...cover,
      rect: new Phaser.Geom.Rectangle(cover.x, cover.y, cover.width, cover.height),
      firePenalty: cover.firePenalty ?? 0
    }));
  }

  static fromJSON(input: string | CoverSystemJsonConfig): CoverSystem {
    const parsed = typeof input === 'string' ? (JSON.parse(input) as CoverSystemJsonConfig) : input;
    return new CoverSystem(parsed);
  }

  getCoverAt(worldX: number, worldY: number): RuntimeCoverObject | null {
    for (const cover of this.covers) {
      const expanded = Phaser.Geom.Rectangle.Clone(cover.rect);
      expanded.x -= this.rules.detectionPadding;
      expanded.y -= this.rules.detectionPadding;
      expanded.width += this.rules.detectionPadding * 2;
      expanded.height += this.rules.detectionPadding * 2;

      if (expanded.contains(worldX, worldY)) {
        return cover;
      }
    }

    return null;
  }

  canShootFromBehindCover(shooter: Phaser.Math.Vector2, target: Phaser.Math.Vector2): boolean {
    const cover = this.getCoverAt(shooter.x, shooter.y);
    if (!cover) {
      return true;
    }

    const distanceToEdge = this.distanceToCoverEdge(shooter, cover.rect);
    if (distanceToEdge > this.rules.maxShootDistanceFromCover) {
      return false;
    }

    const lineToTarget = new Phaser.Geom.Line(shooter.x, shooter.y, target.x, target.y);
    const hitsCover = Phaser.Geom.Intersects.LineToRectangle(lineToTarget, cover.rect);

    return !hitsCover || cover.firePenalty < 1;
  }

  evaluateIncomingDamage(attacker: Phaser.Math.Vector2, target: Phaser.Math.Vector2, baseDamage: number): CoverEvaluationResult {
    const cover = this.getCoverAt(target.x, target.y);
    if (!cover) {
      return {
        hasCover: false,
        coverId: null,
        damageMultiplier: 1
      };
    }

    const shotLine = new Phaser.Geom.Line(attacker.x, attacker.y, target.x, target.y);
    const coverBlocksLine = Phaser.Geom.Intersects.LineToRectangle(shotLine, cover.rect);

    if (!coverBlocksLine) {
      return {
        hasCover: true,
        coverId: cover.id,
        damageMultiplier: 1
      };
    }

    const rawMultiplier = 1 - cover.damageReduction;
    const damageMultiplier = Phaser.Math.Clamp(rawMultiplier, this.rules.minDamageMultiplier, 1);

    return {
      hasCover: true,
      coverId: cover.id,
      damageMultiplier
    };
  }

  applyIncomingDamage(attacker: Phaser.Math.Vector2, target: Phaser.Math.Vector2, baseDamage: number): number {
    const evaluation = this.evaluateIncomingDamage(attacker, target, baseDamage);
    return Math.max(0, Math.round(baseDamage * evaluation.damageMultiplier));
  }

  private distanceToCoverEdge(point: Phaser.Math.Vector2, rect: Phaser.Geom.Rectangle): number {
    const left = Math.abs(point.x - rect.left);
    const right = Math.abs(point.x - rect.right);
    const top = Math.abs(point.y - rect.top);
    const bottom = Math.abs(point.y - rect.bottom);

    return Math.min(left, right, top, bottom);
  }
}
