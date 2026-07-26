# Unity setup

## Required editor

Use **Unity 6.3 LTS**. This environment has no Unity Editor, so no patch number is asserted and `ProjectVersion.txt` is intentionally absent. Install an actual Unity Hub-listed 6.3 LTS patch with Windows Build Support, then let that editor write `ProjectVersion.txt` and resolve the locked packages.

1. Open `unity/NoWayDown` in the installed 6.3 LTS editor.
2. Wait for Package Manager resolution; do not upgrade packages implicitly.
3. Run **NWD > Bootstrap Unity Rebuild**. This deterministically imports canon, generates the first four greybox scenes, and configures Build Settings.
4. Run **NWD > Validate Canonical Campaign**.
5. Bake NavMesh surfaces in the generated gameplay scenes, run EditMode and PlayMode suites, then exercise intro → comedor → pasillos.

URP, Input System, Cinemachine, AI Navigation, Addressables, Test Framework, NGO and Transport are pinned in `Packages/manifest.json`. NGO is isolated behind `ISessionGateway`; online play is not implemented.

## CI secrets

A Unity runner needs `UNITY_LICENSE` (or the GameCI activation flow), `UNITY_EMAIL`, and `UNITY_PASSWORD`. Pin `UNITY_VERSION` to the exact installed 6.3 LTS patch before enabling builds. The checked-in workflow is manual scaffolding and has not run here.
