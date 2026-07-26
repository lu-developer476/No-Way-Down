# Unity setup

## Required editor and honest status

Use a real **Unity 6.3 LTS** patch shown by Unity Hub. No Editor was installed in the implementation environment, so an exact patch is not asserted and `ProjectVersion.txt` is intentionally absent. Do not create it, package-lock data, Unity YAML, GUIDs, or `.meta` files manually.

1. Install the editor and Windows Build Support; open `unity/NoWayDown` and record the exact version Unity writes.
2. Let Package Manager resolve HDRP, Input System, Cinemachine, AI Navigation, Addressables, Test Framework, Timeline, NGO, Transport and UGUI. Commit its regenerated lock.
3. Run **NWD > HDRP > Configure Project**, restart Unity, and run **NWD > Bootstrap Unity Rebuild**.
4. Run both validation menus and EditMode/PlayMode suites. Inspect the benchmark in Play Mode and execute a Windows x64 Development build.
5. Close/reopen the project and confirm stable references and GUIDs.

See `HDRP_MIGRATION.md` for the exact migration procedure and `UNITY_VALIDATION_REPORT.md` for unvalidated items. CI requires an exact `UNITY_VERSION` plus a licensed runner (`UNITY_LICENSE`, or the selected activation flow credentials). The workflow remains manual until those exist.
