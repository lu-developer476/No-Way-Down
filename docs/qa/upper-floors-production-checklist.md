# Upper floors production QA

Run the deployed build with `/?qaCampaign=1`. This checklist does not constitute visual approval until the Render deployment is reviewed.

## Canonical route

Review in order: hall, second floor, stair core, third floor, fourth-floor office route, upper cafeteria, fifth floor, belongings sector, office 422, and the stair core toward the sublevels.

For **every stop**, record pass/fail for: distinctive visual identity; layered architecture; visible grounded entry and exit; contextual objective and prompt; canonical actors; expected infected; player/allies/props grounded; localized foreground fading without prompt obstruction; lighting profile; geometry-based minimap; atlas/light/object budgets; and a transition which preserves direction and lands the whole party on a valid surface.

## Diagnostics

Capture the QA panel values for `nodeId`, `runtimeLevelId`, `floor`, `entryId`, `exitId`, `nextNodeId`, `stairId`, source/target floors, combat state, enemies alive, objective state, environment kit IDs, rendered/foreground/light counts, missing assets, ground errors, and fatal error. Direct QA navigation must not write the normal save.

## Release confirmations

- The three protected maps (comedor resistance, PB corridors/stairs, and ground-floor hall) remain semantically intact.
- Campaign manifest remains 35 ordered nodes; dialogue, cinematics, characters, rescues and consequences remain intact.
- Runtime raster outputs exist only during the art/build pipeline, are real in `dist`, are untracked, and are cleaned afterward.
- `.gitattributes` contains no LFS filter and no manual integration is required.
