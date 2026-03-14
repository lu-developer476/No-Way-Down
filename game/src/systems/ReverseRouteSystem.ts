export interface ReverseRoutePoint {
  x: number;
  y: number;
}

export interface ReverseRouteSection {
  id: string;
  entry_point?: ReverseRoutePoint;
  path_hint?: ReverseRoutePoint[];
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ReverseRouteOption {
  id: string;
  label: string;
  risk?: string;
  path_points: ReverseRoutePoint[];
  notes?: string;
}

export interface ReverseRoutePair {
  mainCorridorRouteId: string;
  internalOfficesRouteId: string;
}

export interface ReverseRouteSectionReuse {
  level8SectionId: string;
  level7SectionIds: string[];
}

export interface ReverseRouteConfig {
  sourceLevelId: string;
  targetLevelId: string;
  sourceSections: ReverseRouteSection[];
  sourceForwardFlow: string[];
  reuse: ReverseRouteSectionReuse[];
  initialRoutes: ReverseRouteOption[];
  routePair: ReverseRoutePair;
  anchorSectionId?: string;
}

export interface ReverseMappedEntity {
  id?: string;
  section_id?: string;
  sectionId?: string;
  [key: string]: unknown;
}

export interface ReverseRouteSnapshot {
  sourceLevelId: string;
  targetLevelId: string;
  anchorSectionId?: string;
  reusedSectionIds: string[];
  forwardFlow: string[];
  reverseFlow: string[];
  routeIds: string[];
}

const REVERSE_META_KEY = 'reverseRoute';

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export class ReverseRouteSystem {
  private readonly config: ReverseRouteConfig;
  private readonly sourceSectionById: Map<string, ReverseRouteSection>;
  private readonly routeById: Map<string, ReverseRouteOption>;

  static fromJson(config: ReverseRouteConfig): ReverseRouteSystem {
    return new ReverseRouteSystem(config);
  }

  constructor(config: ReverseRouteConfig) {
    this.config = deepClone(config);
    this.sourceSectionById = new Map(this.config.sourceSections.map((section) => [section.id, section]));
    this.routeById = new Map(this.config.initialRoutes.map((route) => [route.id, route]));

    this.validateConfig();
  }

  getSnapshot(): ReverseRouteSnapshot {
    return {
      sourceLevelId: this.config.sourceLevelId,
      targetLevelId: this.config.targetLevelId,
      anchorSectionId: this.config.anchorSectionId,
      reusedSectionIds: this.getReusableSectionIds(),
      forwardFlow: [...this.config.sourceForwardFlow],
      reverseFlow: this.getReversedFlow(),
      routeIds: this.config.initialRoutes.map((route) => route.id)
    };
  }

  getReusableSectionIds(): string[] {
    return Array.from(new Set(this.config.reuse.flatMap((entry) => entry.level7SectionIds)));
  }

  getReusableSections(): ReverseRouteSection[] {
    return this.getReusableSectionIds()
      .map((sectionId) => this.sourceSectionById.get(sectionId))
      .filter((section): section is ReverseRouteSection => section !== undefined)
      .map((section) => deepClone(section));
  }

  getReversedFlow(): string[] {
    const flow = [...this.config.sourceForwardFlow];
    const anchor = this.config.anchorSectionId;

    if (!anchor) {
      return flow.reverse();
    }

    const anchorIndex = flow.indexOf(anchor);
    if (anchorIndex < 0) {
      return flow.reverse();
    }

    return flow.slice(0, anchorIndex + 1).reverse();
  }

  getMainCorridorRoute(): ReverseRouteOption {
    return this.getRoute(this.config.routePair.mainCorridorRouteId);
  }

  getInternalOfficesRoute(): ReverseRouteOption {
    return this.getRoute(this.config.routePair.internalOfficesRouteId);
  }

  getCombinedPath(routeId: string): ReverseRoutePoint[] {
    const route = this.getRoute(routeId);
    const reverseFlowPath = this.collectReverseFlowPathHints();

    return [...route.path_points, ...reverseFlowPath].map((point) => ({ ...point }));
  }

  mapCombatZones<T extends ReverseMappedEntity>(zones: T[]): T[] {
    return this.attachReverseMetadata(zones);
  }

  mapTriggers<T extends ReverseMappedEntity>(triggers: T[]): T[] {
    return this.attachReverseMetadata(triggers);
  }

  mapCheckpoints<T extends ReverseMappedEntity>(checkpoints: T[]): T[] {
    return this.attachReverseMetadata(checkpoints);
  }

  private getRoute(routeId: string): ReverseRouteOption {
    const route = this.routeById.get(routeId);
    if (!route) {
      throw new Error(`ReverseRouteSystem: route \"${routeId}\" not found.`);
    }

    return deepClone(route);
  }

  private collectReverseFlowPathHints(): ReverseRoutePoint[] {
    const pointMap = new Map<string, ReverseRoutePoint>();
    const reverseFlow = this.getReversedFlow();

    reverseFlow.forEach((sectionId) => {
      const section = this.sourceSectionById.get(sectionId);
      if (!section) {
        return;
      }

      const sectionPoints: ReverseRoutePoint[] = [
        ...(section.path_hint ?? []),
        ...(section.entry_point ? [section.entry_point] : [])
      ];

      sectionPoints
        .slice()
        .reverse()
        .forEach((point) => {
          const key = `${point.x}:${point.y}`;
          if (!pointMap.has(key)) {
            pointMap.set(key, { x: point.x, y: point.y });
          }
        });
    });

    return Array.from(pointMap.values());
  }

  private attachReverseMetadata<T extends ReverseMappedEntity>(entities: T[]): T[] {
    const reusedSections = new Set(this.getReusableSectionIds());
    const reverseFlow = this.getReversedFlow();
    const reverseIndexBySection = new Map(reverseFlow.map((id, index) => [id, index]));

    return entities
      .map((entity) => deepClone(entity))
      .filter((entity) => {
        const sectionId = this.readSectionId(entity);
        return sectionId ? reusedSections.has(sectionId) : true;
      })
      .sort((left, right) => {
        const leftIndex = reverseIndexBySection.get(this.readSectionId(left) ?? '') ?? Number.MAX_SAFE_INTEGER;
        const rightIndex = reverseIndexBySection.get(this.readSectionId(right) ?? '') ?? Number.MAX_SAFE_INTEGER;
        return leftIndex - rightIndex;
      })
      .map((entity) => {
        const sectionId = this.readSectionId(entity);
        const reverseIndex = sectionId ? reverseIndexBySection.get(sectionId) : undefined;

        return {
          ...entity,
          [REVERSE_META_KEY]: {
            sourceLevelId: this.config.sourceLevelId,
            targetLevelId: this.config.targetLevelId,
            sectionId,
            reverseOrderIndex: reverseIndex,
            isReusedSection: sectionId ? reusedSections.has(sectionId) : false
          }
        };
      });
  }

  private readSectionId(entity: ReverseMappedEntity): string | undefined {
    return entity.section_id ?? entity.sectionId;
  }

  private validateConfig(): void {
    if (this.config.sourceForwardFlow.length === 0) {
      throw new Error('ReverseRouteSystem: sourceForwardFlow cannot be empty.');
    }

    if (this.config.initialRoutes.length < 2) {
      throw new Error('ReverseRouteSystem: at least two initial routes are required.');
    }

    const routeIds = new Set<string>();
    this.config.initialRoutes.forEach((route) => {
      if (routeIds.has(route.id)) {
        throw new Error(`ReverseRouteSystem: duplicated route id \"${route.id}\".`);
      }

      if (route.path_points.length === 0) {
        throw new Error(`ReverseRouteSystem: route \"${route.id}\" must define path_points.`);
      }

      routeIds.add(route.id);
    });

    if (!routeIds.has(this.config.routePair.mainCorridorRouteId)) {
      throw new Error('ReverseRouteSystem: main corridor route id is not defined in initialRoutes.');
    }

    if (!routeIds.has(this.config.routePair.internalOfficesRouteId)) {
      throw new Error('ReverseRouteSystem: internal offices route id is not defined in initialRoutes.');
    }

    const sourceSectionIds = new Set(this.config.sourceSections.map((section) => section.id));

    this.config.sourceForwardFlow.forEach((sectionId) => {
      if (!sourceSectionIds.has(sectionId)) {
        throw new Error(`ReverseRouteSystem: section \"${sectionId}\" from sourceForwardFlow is missing in sourceSections.`);
      }
    });

    this.config.reuse.forEach((reuseEntry) => {
      if (reuseEntry.level7SectionIds.length === 0) {
        throw new Error(`ReverseRouteSystem: reuse entry \"${reuseEntry.level8SectionId}\" must contain at least one source section.`);
      }

      reuseEntry.level7SectionIds.forEach((sectionId) => {
        if (!sourceSectionIds.has(sectionId)) {
          throw new Error(`ReverseRouteSystem: reused section \"${sectionId}\" is not present in sourceSections.`);
        }
      });
    });
  }
}
