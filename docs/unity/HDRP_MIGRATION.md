# HDRP migration runbook

## Status

**Preparación automatizada para migración HDRP; ejecución dentro de Unity pendiente.** The execution environment for this change did not contain Unity Hub or Unity Editor. Consequently there is no `ProjectVersion.txt`, regenerated package lock, Unity-generated HDRP asset, imported `.meta`, compile result, or visual validation in this commit.

The package request replaces URP 17.3.0 with HDRP 17.3.0, keeping the package-family version already present in the foundation manifest rather than proposing a new unverified package combination. Unity Package Manager must resolve and regenerate `Packages/packages-lock.json` using the exact installed Unity 6.3 LTS patch.

## Required editor procedure

1. In Unity Hub, install a real Unity 6.3 LTS release and Windows Build Support (Mono and IL2CPP as required). Record the exact patch; do not create `ProjectVersion.txt` by hand.
2. Open `unity/NoWayDown`. Allow Package Manager to resolve. If HDRP 17.3.0 is rejected by that exact editor, select the HDRP version recommended by its Package Manager and record the complete resolved set.
3. Commit Unity's `ProjectVersion.txt`, regenerated `Packages/packages-lock.json`, completed ProjectSettings, and imported `.meta` files.
4. Run **NWD > HDRP > Configure Project**, restart the editor, and run it again to establish idempotence.
5. Run **NWD > Bootstrap Unity Rebuild**, then **NWD > Validate Canonical Campaign** and **NWD > HDRP > Validate Quality Profiles**.
6. Inspect every generated asset. Configure unsupported serialized HDRP fields reported as warnings rather than suppressing them. Confirm gameplay profiles have no DOF or motion blur.
7. Close/reopen Unity, perform a full reimport, run EditMode and PlayMode, enter the benchmark, and produce a Windows x64 Development build.

The configurator creates or reuses Global Settings, four pipeline assets, and Default, Gameplay, Cinematic, and Benchmark volume profiles below `Assets/NWD/Rendering/HDRP`. It assigns High as default, Linear color space, attempts version-compatible serialized feature switches, records unsupported properties, and writes a SHA-256 of the source JSON.
