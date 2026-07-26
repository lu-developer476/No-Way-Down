# Vertical slice 01

Scope is restricted to `campaign-intro`, `lvl01-esc01-comedor-resistencia`, `lvl01-esc02-pasillos-hacia-escaleras-pb`, and `lvl01-cin01-cierre-contextual`, in that canonical order.

The bootstrap generates provisional scene roots for intro UI/skip, the defendable bank dining room, office corridors, and contextual Timeline staging. Gameplay roots include floor, lighting, player/squad/infected spawns and an objective volume. The runtime foundations provide FPS locomotion/input, pistol/rifle/melee definitions, hitscan/health/noise, infected and squad navigation, hold/advance objectives and transactional campaign transition.

This is code-first greybox scaffolding, not a visually completed slice. Unity was unavailable here: scenes, Timeline assets, NavMesh bakes, package resolution, compilation, EditMode, PlayMode and the end-to-end route remain mandatory editor validation steps.
