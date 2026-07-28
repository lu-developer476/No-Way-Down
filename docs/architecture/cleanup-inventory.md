# Runtime cleanup inventory

This inventory was captured before deletion. Runtime participation is measured from
`game/src/main.ts`; a test importing an otherwise unreachable module is not a runtime
consumer.

| Status | Path / domain | Current responsibility and consumers | Runtime / duplicate | Replacement and deletion proof |
|---|---|---|---|---|
| PROTECTED | `game/public/favicon.png`, `game/public/assets/images/NWD-menu.png`, `NWD-characters.png`, all tracked binary assets | Canonical branding, characters, photographs, scenery, UI and audio | Active content; never cleanup candidates | SHA-256 manifest plus `audit:protected-assets` and `audit:no-binary-diff` |
| PROTECTED | `game/public/assets/campaign`, `dialogues`, `cinematics`, `characters`, `levels` | Narrative canon and runtime rules imported by campaign and level flow | Active authorities, not spatial replacements | Campaign audit and immutable-diff gate |
| KEEP | `src/main.ts`, Boot, preload, menu, intro, cinematic, dialogue and UI scenes | Phaser application and canonical scene flow | Runtime | TypeScript, campaign and scene-flow tests |
| MIGRATE | `src/scenes/LevelScene.ts` | Canonical gameplay scene; imported by `main.ts` | Runtime; currently inherits the monolithic `GameScene` | Thin LevelScene orchestration over `LevelRuntime`; loading/world lifecycle tests |
| REPLACE | `src/scenes/GameScene.ts` | Arcade actors, world drawing, missions, saves, UI and transitions | Runtime; duplicates domain systems and renderers | `LevelRuntime`, Tiled world builder and Matter services; Matter-only audit |
| DELETE | `src/scenes/UpperFloorScene.ts` | Parallel gameplay implementation imported only by `main.ts` | Runtime registration duplicates LevelScene | Canonical manifest maps every level node to LevelScene; campaign audit |
| REPLACE | Arcade `Player`, `AllyAI`, `Zombie`, spawn and projectile implementations | Arcade bodies, collisions and combat | Runtime through GameScene | Matter actors, collision router and pooling; physics behavior tests |
| KEEP | `ObjectiveSystem`, `InteractableSystem`, campaign transition coordinator | Rules, explicit E interaction and transactional campaign progression | Runtime canonical authority | Tiled IDs feed these systems; transition tests |
| MIGRATE | `SpawnManager` / `SpawnSystem`, `MissionSystem` / `MissionRuntimeSystem`, `CombatSystem` / `ZombieSystem` | Duplicate factories and state wrappers | Runtime duplication | One LevelRuntime service per domain; reachability and lifecycle tests |
| REPLACE | `StairSegmentSystem`, `StaircaseSystem`, `world/StairTraversalSystem` | Three incompatible stair models | Runtime/test duplication | `MatterStairSystem` driven by Tiled stair objects; traversal tests |
| DELETE | Visual V2 configs/system, corridor renderer/config, institutional lighting, minimap | Procedural experimental presentation layered over gameplay | Runtime through GameScene and preload | Tiled visual layers and asset resolver; no fallback test |
| DELETE | `campaignWorldDefinitions`, `worldAssetCatalog`, `CampaignWorldRegistry`, authored renderer, topology, connectors, diagnostics and save migration | Generated spatial catalogue and a parallel connector graph | Runtime through GameScene; duplicates Tiled and campaign flow | Per-level `.tmj`, Tiled repository/builder and checkpoint migration tests |
| DELETE | Visual/spritesheet/tileset generators and experiment-specific audits | Create binary or abandoned procedural outputs | Development only | Text-only Tiled/audit commands; package script inspection |
| KEEP | Runtime JSON referenced by canonical wrappers | Objectives, balance, enemies, pickups, dialogue, events and rules | Runtime authority | Cross-reference audit against Tiled IDs |
| MIGRATE | `AssetPreloadScene` | Globally loads menu plus campaign-wide textures | Runtime; excessive scope | Global-only preload and reference-counted per-map loading; asset lifecycle tests |

## Import-graph baseline

The graph rooted at `src/main.ts` reaches the canonical scenes, while `LevelScene ->
GameScene` pulls most legacy actors, renderers and duplicate world systems into
production. Examples and many specialist systems have no path from the entrypoint;
tests alone currently keep several of them visible. `audit:runtime-reachability`
recomputes this graph, reports cycles, test-only modules and unused exports, and the
final cleanup treats its allow-list as intentional public API rather than evidence
that dead code is useful.
