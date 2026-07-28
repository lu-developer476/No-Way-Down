# Visual Render checklist

This checklist is intentionally manual. Automated checks validate structure and
lifecycle, not artistic quality. Do not mark it approved without reviewing a deployed
build at desktop and narrow viewport sizes.

- [ ] Existing menu image, layout and intro remain intact.
- [ ] Comedor reads as an institutional basement dining area across all five sectors.
- [ ] Resistance area, player, allies, zombies, objective and exit remain legible.
- [ ] Lighting adds depth without hiding interaction prompts or pixel-art silhouettes.
- [ ] HUD shows one compact health/weapon/ammo/objective/inventory presentation.
- [ ] Minimap is in the upper right and matches Tiled bounds, stairs and exit geometry.
- [ ] Pasillos reads as six distinct sectors and visually leads to reachable stairs.
- [ ] Foreground creates depth without changing collisions or obscuring threats.
- [ ] Contextual closure transitions into a clearly brighter, taller Planta Baja hall.
- [ ] Hall reception, columns, blocked accesses, main doors and vertical core are distinct.
- [ ] Remaining canonical levels have no empty background and show correct location/floor.
- [ ] Level transitions show no missing-texture or duplicate-texture warnings.
- [ ] Returning to/restarting a level does not duplicate HUD, lights, timers or listeners.
- [ ] Characters and zombies retain identity, crisp scaling, grounding and readable bars.
- [ ] Camera follows smoothly, respects bounds and handles stairs without abrupt zoom.
- [ ] Canvas fallback remains playable and clearly reports reduced lighting diagnostics.
- [ ] Frame pacing is acceptable during traversal and combat; note device/browser/FPS.

Known pre-existing issue: production E2E waits for runtime.exitReady and is outside
this visual/project milestone.
