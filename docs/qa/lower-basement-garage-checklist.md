# QA: lower basements and garage

Open `/?qaCampaign=1`. QA state uses its isolated namespace and must not modify the normal save.

## Canonical scope derived before editing

The manifest boundary is index 17 (the node immediately after the PR #427 playable block) through index 29, immediately before the first clearly exterior playable node at index 30. Runtime paths and map paths below come from each level configuration/runtime configuration; cinematics intentionally have no runtime map.

| index | nodeId | type | runtimeLevelId / config / map | previous → next | objective / party / combat | entry → exit | floor / location |
|---:|---|---|---|---|---|---|---|
|17|lvl07-cin01-inicio-del-descenso|cinematic|— / `assets/cinematics/lvl07_inicio_descenso.json` / —|lvl07-esc01-oficina-422-rescate → lvl08-esc01-descenso-con-temporizador|Inicio canónico del descenso / grupo heredado / none|oficina 422 → núcleo de escaleras|4 → subsuelos / escalera|
|18|lvl08-esc01-descenso-con-temporizador|level|level_8_pasillo_subsuelo2_escaleras_subsuelo3 / `assets/levels/level8_descenso_temporizador.json` / `assets/tiled/maps/level_8_pasillo_subsuelo2_escaleras_subsuelo3.tmj`|lvl07-cin01-inicio-del-descenso → lvl08-cin01-damian-infectado-y-suicidio|Llegar a S3 antes de 3:00 / grupo canónico / timed-descent-pursuit|default → escalera-subsuelo-3|S2→S3 / núcleo técnico|
|19–21|lvl08-cin01-damian-infectado-y-suicidio; lvl08-cin02-sacrificio-hernan-yamil; lvl08-cin03-caida-final-del-duo|cinematic|— / rutas canónicas de `assets/cinematics/` / —|descenso → verificación|Eventos canónicos, personajes y pérdidas intactos / none|S3 → S3|S3 / descansos finales|
|22|lvl09-esc01-verificacion-salidas|level|level_9_verificacion_salidas / `assets/levels/level9_verificacion_salidas.json` / `assets/tiled/maps/level_9_verificacion_salidas.tmj`|lvl08-cin03-caida-final-del-duo → lvl09-cin01-hallazgo-salida-y-mordida-selene|Verificar A–E / grupo canónico / exit-verification|spawn S3 → salida-e-garage|S3 / control de seguridad|
|23–24|lvl09-cin01-hallazgo-salida-y-mordida-selene; lvl09-cin02-traicion-de-selene-y-huida|cinematic|— / rutas canónicas de `assets/cinematics/` / —|verificación → búsqueda|Mordida/traición canónicas; party derivada por campaña / none|seguridad → garage|S3 / acceso garage|
|25|lvl10-esc01-garage-busqueda-vehiculo|level|level_9_subsuelo3_garage_salida / `assets/levels/level10_vehicle_loot.json` / `assets/tiled/maps/level_9_subsuelo3_garage_salida.tmj`|traición → hallazgo vehículo|Mapa, llaves, sedán / grupo canónico / garage-search|acceso garage → abordar-sedan|S3 / garage|
|26|lvl10-cin01-hallazgo-del-vehiculo|cinematic|— / `assets/cinematics/lvl10_hallazgo_vehiculo.json` / —|búsqueda → resistencia|Hallazgo canónico / grupo canónico / none|vehículo → defensa|S3 / garage|
|27|lvl10-esc02-resistencia-en-garage|level|level_9_subsuelo3_garage_salida / `assets/levels/level10_parking_survival.json` / `assets/tiled/maps/level_9_subsuelo3_garage_salida.tmj`|hallazgo → salida garage|Resistir 10:00 / grupo canónico / garage-defense|sedán → garage-exterior-gate|S3 / garage|
|28–29|lvl10-cin02-salida-del-garage; lvl10-cin01-traslado-silencioso-plaza-de-mayo|cinematic|— / rutas canónicas de `assets/cinematics/` / —|resistencia → lvl10-esc01-combate-50-bajas-en-via-publica|Salida y traslado intactos / Alan y Giovanna según canon / none|portón → exterior|S3→0 / transición exterior|

## Manual checklist

- **Descent:** timer starts once; pauses in pause/dialogue; stairs and nine elevations descend; camera and allies follow; enemies spawn; win enables the visible final door and transitions; loss disables it, preserves cursor/checkpoint, and restart resets; timer/audio stop after transition.
- **Subsoil 3:** flooded identity, steam, machinery, pipes, local darkness, damage, combat, contextual objective, visible entry/exit.
- **Exit verification:** inspect all five physically separated doors; prompts appear only in range; each updates `Salidas verificadas: n / 5` once; visual/text feedback matches its result; continuation unlocks after five.
- **Garage:** inspect all nine sectors, columns, ramp, six vehicle silhouettes, puddles/oil, industrial lighting and foreground fading; search map/keys/vehicle once; verify combat, minimap discovery, gate and canonical exit.
- **Exterior transition:** load index 30; verify correct node/group/spawn and no `fatalError`. Do not assess exterior art in this milestone.

Record browser, difficulty (Complejo/Pesadilla), nodeId, runtimeLevelId, failing connector and reproduction steps. Visual approval requires a separate deployed Render review; no screenshots are committed by this checklist.
