import Phaser from 'phaser';

export type FoodCartState = 'intact' | 'damaged' | 'destroyed';

export interface FoodCartDefinition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  maxHp: number;
  coverReduction: number;
  pushResistance?: number;
  blocksZombies?: boolean;
}

export interface FoodCartRules {
  damagedThreshold: number;
  maxCoverDistance: number;
  minDamageMultiplier: number;
  defaultPushResistance: number;
  movableWhenDestroyed: boolean;
  worldBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FoodCartSystemConfig {
  carts: FoodCartDefinition[];
  rules?: Partial<FoodCartRules>;
}

export interface FoodCartSnapshot extends FoodCartDefinition {
  hp: number;
  state: FoodCartState;
}

export interface CoverResult {
  hasCover: boolean;
  cartId: string | null;
  damageMultiplier: number;
}

export interface PushResult {
  cartId: string;
  moved: boolean;
  previousPosition: Phaser.Math.Vector2;
  currentPosition: Phaser.Math.Vector2;
  blockedByWorldBounds: boolean;
}

interface RuntimeFoodCart {
  definition: FoodCartDefinition;
  position: Phaser.Math.Vector2;
  hp: number;
}

const DEFAULT_RULES: FoodCartRules = {
  damagedThreshold: 0.5,
  maxCoverDistance: 28,
  minDamageMultiplier: 0.2,
  defaultPushResistance: 1,
  movableWhenDestroyed: false
};

export class FoodCartSystem {
  private readonly carts = new Map<string, RuntimeFoodCart>();
  private readonly rules: FoodCartRules;

  constructor(config: FoodCartSystemConfig) {
    this.rules = {
      damagedThreshold: config.rules?.damagedThreshold ?? DEFAULT_RULES.damagedThreshold,
      maxCoverDistance: config.rules?.maxCoverDistance ?? DEFAULT_RULES.maxCoverDistance,
      minDamageMultiplier: config.rules?.minDamageMultiplier ?? DEFAULT_RULES.minDamageMultiplier,
      defaultPushResistance: config.rules?.defaultPushResistance ?? DEFAULT_RULES.defaultPushResistance,
      movableWhenDestroyed: config.rules?.movableWhenDestroyed ?? DEFAULT_RULES.movableWhenDestroyed,
      worldBounds: config.rules?.worldBounds
    };

    for (const cart of config.carts) {
      this.carts.set(cart.id, {
        definition: {
          ...cart,
          blocksZombies: cart.blocksZombies ?? true,
          pushResistance: cart.pushResistance ?? this.rules.defaultPushResistance
        },
        position: new Phaser.Math.Vector2(cart.x, cart.y),
        hp: cart.maxHp
      });
    }
  }

  static fromJSON(input: string | FoodCartSystemConfig): FoodCartSystem {
    const parsed = typeof input === 'string' ? (JSON.parse(input) as FoodCartSystemConfig) : input;
    return new FoodCartSystem(parsed);
  }

  getCart(id: string): FoodCartSnapshot {
    const runtime = this.getRuntimeOrThrow(id);
    return this.toSnapshot(runtime);
  }

  getAllCarts(): FoodCartSnapshot[] {
    return Array.from(this.carts.values(), (runtime) => this.toSnapshot(runtime));
  }

  canZombiePass(worldPosition: Phaser.Math.Vector2): boolean {
    return this.getBlockingCartAt(worldPosition) === null;
  }

  getBlockingCartAt(worldPosition: Phaser.Math.Vector2): FoodCartSnapshot | null {
    for (const runtime of this.carts.values()) {
      const state = this.getState(runtime);
      if (!runtime.definition.blocksZombies || state === 'destroyed') {
        continue;
      }

      if (this.getRect(runtime).contains(worldPosition.x, worldPosition.y)) {
        return this.toSnapshot(runtime);
      }
    }

    return null;
  }

  evaluateCover(attacker: Phaser.Math.Vector2, target: Phaser.Math.Vector2, baseDamage: number): CoverResult {
    const coverCart = this.findCoverCart(attacker, target);
    if (!coverCart) {
      return {
        hasCover: false,
        cartId: null,
        damageMultiplier: 1
      };
    }

    const rawMultiplier = 1 - coverCart.definition.coverReduction;
    const damageMultiplier = Phaser.Math.Clamp(rawMultiplier, this.rules.minDamageMultiplier, 1);

    return {
      hasCover: true,
      cartId: coverCart.definition.id,
      damageMultiplier: baseDamage <= 0 ? 1 : damageMultiplier
    };
  }

  applyCoverDamage(attacker: Phaser.Math.Vector2, target: Phaser.Math.Vector2, baseDamage: number): number {
    const result = this.evaluateCover(attacker, target, baseDamage);
    return Math.max(0, Math.round(baseDamage * result.damageMultiplier));
  }

  pushCart(cartId: string, direction: Phaser.Math.Vector2, pushStrength: number): PushResult {
    const runtime = this.getRuntimeOrThrow(cartId);
    const state = this.getState(runtime);
    const previousPosition = runtime.position.clone();

    if (state === 'destroyed' && !this.rules.movableWhenDestroyed) {
      return {
        cartId,
        moved: false,
        previousPosition,
        currentPosition: runtime.position.clone(),
        blockedByWorldBounds: false
      };
    }

    const resistance = runtime.definition.pushResistance ?? this.rules.defaultPushResistance;
    const distance = Math.max(0, pushStrength) / Math.max(0.0001, resistance);
    if (distance === 0 || direction.lengthSq() === 0) {
      return {
        cartId,
        moved: false,
        previousPosition,
        currentPosition: runtime.position.clone(),
        blockedByWorldBounds: false
      };
    }

    const movement = direction.clone().normalize().scale(distance);
    runtime.position.add(movement);

    let blockedByWorldBounds = false;
    if (this.rules.worldBounds) {
      const bounds = new Phaser.Geom.Rectangle(
        this.rules.worldBounds.x,
        this.rules.worldBounds.y,
        this.rules.worldBounds.width,
        this.rules.worldBounds.height
      );

      const rect = this.getRect(runtime);
      if (!Phaser.Geom.Rectangle.ContainsRect(bounds, rect)) {
        blockedByWorldBounds = true;
        const halfWidth = runtime.definition.width * 0.5;
        const halfHeight = runtime.definition.height * 0.5;
        runtime.position.x = Phaser.Math.Clamp(runtime.position.x, bounds.left + halfWidth, bounds.right - halfWidth);
        runtime.position.y = Phaser.Math.Clamp(runtime.position.y, bounds.top + halfHeight, bounds.bottom - halfHeight);
      }
    }

    return {
      cartId,
      moved: !runtime.position.equals(previousPosition),
      previousPosition,
      currentPosition: runtime.position.clone(),
      blockedByWorldBounds
    };
  }

  applyDamage(cartId: string, damage: number): FoodCartState {
    const runtime = this.getRuntimeOrThrow(cartId);
    if (this.getState(runtime) === 'destroyed') {
      return 'destroyed';
    }

    runtime.hp = Math.max(0, runtime.hp - Math.max(0, damage));
    return this.getState(runtime);
  }

  private findCoverCart(attacker: Phaser.Math.Vector2, target: Phaser.Math.Vector2): RuntimeFoodCart | null {
    const shotLine = new Phaser.Geom.Line(attacker.x, attacker.y, target.x, target.y);

    for (const runtime of this.carts.values()) {
      if (this.getState(runtime) === 'destroyed') {
        continue;
      }

      const rect = this.getRect(runtime);
      const targetDistance = Phaser.Math.Distance.Between(target.x, target.y, rect.centerX, rect.centerY);
      if (targetDistance > this.rules.maxCoverDistance) {
        continue;
      }

      if (Phaser.Geom.Intersects.LineToRectangle(shotLine, rect)) {
        return runtime;
      }
    }

    return null;
  }

  private getRect(runtime: RuntimeFoodCart): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      runtime.position.x - runtime.definition.width * 0.5,
      runtime.position.y - runtime.definition.height * 0.5,
      runtime.definition.width,
      runtime.definition.height
    );
  }

  private getState(runtime: RuntimeFoodCart): FoodCartState {
    if (runtime.hp <= 0) {
      return 'destroyed';
    }

    const ratio = runtime.hp / Math.max(1, runtime.definition.maxHp);
    if (ratio <= this.rules.damagedThreshold) {
      return 'damaged';
    }

    return 'intact';
  }

  private toSnapshot(runtime: RuntimeFoodCart): FoodCartSnapshot {
    return {
      ...runtime.definition,
      x: runtime.position.x,
      y: runtime.position.y,
      hp: runtime.hp,
      state: this.getState(runtime)
    };
  }

  private getRuntimeOrThrow(cartId: string): RuntimeFoodCart {
    const runtime = this.carts.get(cartId);
    if (!runtime) {
      throw new Error(`Food cart not found: ${cartId}`);
    }

    return runtime;
  }
}
