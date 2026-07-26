# Canonical campaign contract

`game/public/assets/campaign/canonical_campaign_manifest.json` is the sole authority. The byte-for-byte Unity working source is `Assets/NWD/Narrative/Source/canonical_campaign_manifest.json`; it must be refreshed only by an explicit repository copy, never by editing canon through Unity.

The importer requires `main_campaign`, exactly 35 ordered, non-empty, unique node IDs, calculates SHA-256 over source JSON, and deterministically regenerates one asset. No legacy flow or silent fallback exists. Only the first four nodes are Greybox; all remaining nodes stay Unimplemented. Validation rejects implemented nodes without scene content. Internal scene, Timeline, mission and spawn references cannot alter IDs or order.
