# Unity rebuild architecture

Phaser remains untouched legacy reference. Runtime code is split by responsibility across Core, Narrative, Campaign, Application, Player, Combat, Enemies, Squad, Missions, Save, Networking, Scenes and Benchmark assemblies.

`BootstrapController` loads Persistent additively, waits for `GameCompositionRoot`, and starts a new campaign, continues a valid save, or opens isolated benchmark mode. The persistent root constructs the one `CampaignDirector`, JSON save, scene loader, session, input/audio placeholders and offline future gateway without scene-wide object searches. Canonical destinations confirm readiness before the director advances/saves; the prior scene unloads only after confirmation.

`NWD/Bootstrap Unity Rebuild` validates the actual 6.3 editor and packages, requires active HDRP, imports the immutable 35-node manifest, configures HDRP, and creates/reuses Bootstrap, Persistent, only the first four canonical greyboxes, and VisualBenchmark. Named roots and `GeneratedContentMarker` distinguish generated objects. Existing scenes are opened and augmented, never blindly replaced; manual/artistic scene replacement remains an explicit human decision.

Normal Build Settings contain Bootstrap, Persistent and four canonical scenes. Benchmark is present but disabled; enable it only in a dedicated Development configuration. Unity execution and persistence validation remain pending as recorded in `UNITY_VALIDATION_REPORT.md`.
