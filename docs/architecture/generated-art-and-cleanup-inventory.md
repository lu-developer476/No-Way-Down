# Generated art and runtime cleanup inventory

This inventory was captured before deleting any candidate. The production graph starts at
`game/src/main.ts`, follows its registered scenes and their static/dynamic imports, and also
accounts for `package.json`, CI/Render commands, runtime URL loads, the canonical campaign,
and Tiled data. A test-only import is not considered a production consumer.

| Classification | Path/candidate | Responsibility and imports | Runtime/build consumer | Replacement / decision |
|---|---|---|---|---|
| KEEP | `game/src/main.ts`, reachable Arcade scenes/systems | Phaser entry point and deployed scene graph | Vite runtime | Production remains Arcade. |
| GENERATED | `game/public/assets/production-art/{characters,zombies,weapons,ui}/*.png` | Character sheets, zombie sheets and portraits loaded by URL | `AssetPreloadScene`, Vite public copy | Generated offline by `generateProductionCharacters.py`; never tracked. Existing files are LFS pointer text and are replaced. |
| KEEP | `game/public/assets/production-art/characters/character_art_manifest.json` | Text manifest imported by `ProductionCharacterArt` | runtime and generated-art audits | Remains versioned and declares paths, frames, anchors and profiles. |
| KEEP | `game/scripts/art/generateProductionCharacters.py` | Deterministic standard-library PNG authoring | `predev`, `prebuild`, verification | Improve and retain as the sole runtime-art generator. |
| REPLACE | `game/config/approved-production-art.json`, `auditApprovedProductionArt.mjs` | LFS-era binary approval/config audit | old build | Replace with expected-output config and generated-file audit. |
| DELETE | `.gitattributes` production-art rules and workflow LFS steps | LFS filtering/hydration/transfer | GitHub Actions and mirror | Generated outputs make LFS both unnecessary and unreliable. Keep the GitLab mirror itself. |
| KEEP | `game/src/visual/ProductionCharacterArt.ts`, `GroundAnchorSystem.ts` | Mandatory sheet registry and foot-coordinate layout | preload/gameplay | Retain with fatal missing-art handling and explicit per-character mappings. |
| DELETE | `game/src/physics/Matter*.ts`, `CollisionCategories.ts`, `GroundContactTracker.ts`, `game/src/runtime/LevelRuntime.ts`, `game/src/tiled/TiledWorldBuilder.ts` | Parallel Matter-only runtime reachable only from the abandoned loading path/tests | no deployed Arcade scene | Delete after removing the abandoned scene/path; no canonical node loads it by URL. |
| DELETE | `GameScene.ts`, `LevelLoadingScene.ts`, `LoadingScene.ts`, `UpperFloorScene.ts` where reachability audit confirms no canonical transition | Superseded scene implementations | registration/test-only references | Remove rather than retain duplicate gameplay. Migrate only canonical behavior if a real transition is found. |
| DELETE | `game/public/assets/visual-v2/`, V2 catalog/presentation/config and exclusive audits/tests | Earlier SVG presentation pipeline | no deployed scene after graph traversal | Remove textual obsolete pipeline; do not delete historical binaries. |
| KEEP | Tiled loaders/parsers/renderers reached by Arcade production | Runtime parsing of authored data | `LevelScene` | Preserve when imported by the real graph. |
| FUTURE AUTHORING | `game/public/assets/tiled/`, `game/tiled/`, unused authoring-only Tiled helpers | Source maps and editor metadata | Tiled authoring, audits | Preserve maps even when not a deployed runtime module; exclude explicitly from reachability. |
| PROTECTED | campaign manifest, dialogues, cinematics, characters, levels, menu/character images, favicon, photos, backgrounds, audio/music | Approved story and historical assets | campaign/runtime/protected-assets audit | Never delete or modify in this work. The canonical manifest remains 35 nodes. |
| KEEP | reachable campaign, save, party, objective, combat and world systems | Functional game/story graph | `LevelScene` and campaign flow | Preserve gameplay, story, difficulty and balance. |

Reachability exclusions are limited to TypeScript declaration/type-only files, tests, Node/Python
scripts, configuration, the generated manifest/data loaded by URL, and preserved Tiled authoring.
Workflows must name existing scripts and use the build itself as the single generation point.


## Upper-floor decision

`UpperFloorScene` is **KEEP**, not speculative: `GameScene` creates the canonical default
`LevelExitSystem` transition with `sceneKey: 'UpperFloorScene'` whenever a level has no explicit
runtime exit. `UpperFloorScene` then returns through the campaign transition coordinator. Removing
it would break real level progression, so it remains registered; the disconnected Matter
`LevelLoadingScene` path is removed instead.
