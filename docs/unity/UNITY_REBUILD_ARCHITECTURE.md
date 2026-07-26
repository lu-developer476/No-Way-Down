# Unity rebuild architecture

Phaser remains frozen legacy reference. Unity uses assemblies for Core, Narrative, Campaign, Player, Combat, Enemies, Squad, Missions, Save and Networking.

## Runtime composition

`Bootstrap` validates configuration and loads `Persistent`. Persistent services own the session, campaign, atomic save, loading, global UI/audio and the future network gateway. Campaign and narrative scenes load additively. A transition validates canonical next, persists the pre-commit state, shows loading, unloads prior content, loads destination, positions the party, and only commits via `ConfirmDestinationReady`. Failure cancels pending state and preserves the valid save.

The FPS is split into input, motor, look and weapons. Combat emits central noise; infected subscribe and navigate to audible events. Horde evaluation is scheduled rather than per-frame. Squad members expose an interface suitable for three narrative companions. Objectives are data definitions plus single-completion runtime instances.

## Generated content

`NWD/Bootstrap Unity Rebuild` is idempotent by named roots. It creates Bootstrap, Persistent and four canonical greybox scenes using primitives, provisional lights, spawn/objective roots, then writes Build Settings. Generated scenes/assets should only be refreshed from the immutable source manifest.
