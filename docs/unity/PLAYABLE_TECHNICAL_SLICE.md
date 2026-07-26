# Playable technical slice — validation pending

## Status

This change is **source preparation only**. The current automation environment does not contain Unity Editor or Unity Hub. Consequently, this document does not claim that HDRP is active, that generated assets/scenes/prefabs exist, that tests pass, or that a Windows executable was produced.

## Implemented source preparation

- Project-scoped, reload-safe phased setup commands prepare HDRP, generate content, validate, or coordinate the complete sequence.
- The High pipeline is selected by setup and an `AppliedHdrpConfiguration.asset` report is produced by Unity, never hand-authored.
- Gameplay input now includes keyboard/mouse and gamepad bindings for Flashlight and all technical actions.
- Character-controller locomotion includes acceleration, air control, grounded sprint gating, gradual crouching, ceiling checks, gravity, and jumping.
- Flashlight input, hitscan filtering, configurable headshot damage, firearm cadence, static noise cleanup, scene-load results, transition timeout/rollback, benchmark components/material assignments, and a Windows x64 Development builder are prepared.

## Required Unity 6.3 LTS validation

1. Open `unity/NoWayDown` with an installed Unity 6.3 LTS patch and allow Package Manager/import to finish.
2. Run **NWD > Setup > Run Complete Setup**, restart when requested, then reopen and validate references.
3. Allow Unity—not a text editor—to create `ProjectVersion.txt`, `packages-lock.json`, `.meta`, HDRP assets, scenes, prefabs, and NavMesh data.
4. Run EditMode and PlayMode suites with zero unexpected ignored tests.
5. Exercise every control and enemy state in VisualBenchmark, inspect the console, missing scripts, materials, and scene cleanup.
6. Capture the required real Editor/build views and record hardware, resolution, High-profile FPS, and frame time.
7. Run **NWD > Build > Windows x64 Development** only after tests pass; do not commit `Builds/`.

## Measurements and evidence

| Item | Result |
|---|---|
| Unity version | Not resolved (Editor unavailable) |
| HDRP resolved version | Not resolved |
| EditMode / PlayMode | Not run |
| Passed / failed / ignored | Not measured |
| Windows build | Not generated |
| Hardware / resolution / profile | Not measured |
| FPS / frame time | Not measured |
| Captures | Not generated |

## Remaining milestone

Complete a real Unity import/compile cycle, correct package-API incompatibilities, generate and version Unity-authored assets, implement/verify the full prefabs, HUD/menu/pause presentation and autonomous scene tests, bake navigation, capture evidence, and produce the Development build. The canonical 35-node manifest, Phaser application, backend, story, and multiplayer remain outside this slice.
