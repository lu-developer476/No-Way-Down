# Full campaign certification checklist

## Automated scope

- [x] Main menu, New game setup, Options, Exit feedback and Continue state are data-tested.
- [x] Active-run reload, corrupt/incompatible saves, checkpoints and completion history have contracts.
- [x] Intro, upper floors, timed descent, basements, exit verification, garage, exterior defence, San Telmo and open ending are manifest-derived.
- [x] Pause/resume, defeat, HUD, objective toast, minimap, audio and resource lifecycle have textual diagnostics hooks.
- [x] Build identity distinguishes GitHub `sourceSha` from GitLab/Render `deployCommit`.
- [ ] Manual visual, audio and play-feel acceptance remains pending; automation does not claim visual approval.

## Node results

| Automated | Manual | nodeId | scene | objective | transition | observations |
|---|---|---|---|---|---|---|
| CI shard 0 | Pending | campaign-intro | CampaignIntroScene | — | lvl01-esc01-comedor-resistencia | Flat snapshot; no image evidence |
| CI shard 0 | Pending | lvl01-esc01-comedor-resistencia | LevelScene | — | lvl01-esc02-pasillos-hacia-escaleras-pb | Flat snapshot; no image evidence |
| CI shard 0 | Pending | lvl01-esc02-pasillos-hacia-escaleras-pb | LevelScene | — | lvl01-cin01-cierre-contextual | Flat snapshot; no image evidence |
| CI shard 0 | Pending | lvl01-cin01-cierre-contextual | CinematicScene | — | lvl02-esc01-hall-planta-baja | Flat snapshot; no image evidence |
| CI shard 0 | Pending | lvl02-esc01-hall-planta-baja | LevelScene | — | lvl02-cin01-ascenso-al-segundo-piso | Flat snapshot; no image evidence |
| CI shard 0 | Pending | lvl02-cin01-ascenso-al-segundo-piso | CinematicScene | — | lvl03-esc01-segundo-piso | Flat snapshot; no image evidence |
| CI shard 0 | Pending | lvl03-esc01-segundo-piso | LevelScene | — | lvl03-cin01-llamado-lorena-rescate | Flat snapshot; no image evidence |
| CI shard 0 | Pending | lvl03-cin01-llamado-lorena-rescate | CinematicScene | — | lvl04-esc01-tercer-piso | Flat snapshot; no image evidence |
| CI shard 0 | Pending | lvl04-esc01-tercer-piso | LevelScene | — | lvl04-cin01-rescate-lorena-en-oficina-422 | Flat snapshot; no image evidence |
| CI shard 1 | Pending | lvl04-cin01-rescate-lorena-en-oficina-422 | CinematicScene | — | lvl04-cin02-llamada-selene-y-descenso | Flat snapshot; no image evidence |
| CI shard 1 | Pending | lvl04-cin02-llamada-selene-y-descenso | CinematicScene | — | lvl05-esc01-cuarto-piso-comedor | Flat snapshot; no image evidence |
| CI shard 1 | Pending | lvl05-esc01-cuarto-piso-comedor | LevelScene | — | lvl05-cin01-descenso-al-quinto-piso | Flat snapshot; no image evidence |
| CI shard 1 | Pending | lvl05-cin01-descenso-al-quinto-piso | CinematicScene | — | lvl06-esc01-quinto-piso-pertenencias | Flat snapshot; no image evidence |
| CI shard 1 | Pending | lvl06-esc01-quinto-piso-pertenencias | LevelScene | — | lvl06-cin01-reencuentro-y-salida-e | Flat snapshot; no image evidence |
| CI shard 1 | Pending | lvl06-cin01-reencuentro-y-salida-e | CinematicScene | — | lvl06-cin02-muerte-lorena-y-guardia-en-salida-e | Flat snapshot; no image evidence |
| CI shard 1 | Pending | lvl06-cin02-muerte-lorena-y-guardia-en-salida-e | CinematicScene | — | lvl07-esc01-oficina-422-rescate | Flat snapshot; no image evidence |
| CI shard 1 | Pending | lvl07-esc01-oficina-422-rescate | LevelScene | — | lvl07-cin01-inicio-del-descenso | Flat snapshot; no image evidence |
| CI shard 1 | Pending | lvl07-cin01-inicio-del-descenso | CinematicScene | — | lvl08-esc01-descenso-con-temporizador | Flat snapshot; no image evidence |
| CI shard 2 | Pending | lvl08-esc01-descenso-con-temporizador | LevelScene | — | lvl08-cin01-damian-infectado-y-suicidio | Flat snapshot; no image evidence |
| CI shard 2 | Pending | lvl08-cin01-damian-infectado-y-suicidio | CinematicScene | — | lvl08-cin02-sacrificio-hernan-yamil | Flat snapshot; no image evidence |
| CI shard 2 | Pending | lvl08-cin02-sacrificio-hernan-yamil | CinematicScene | — | lvl08-cin03-caida-final-del-duo | Flat snapshot; no image evidence |
| CI shard 2 | Pending | lvl08-cin03-caida-final-del-duo | CinematicScene | — | lvl09-esc01-verificacion-salidas | Flat snapshot; no image evidence |
| CI shard 2 | Pending | lvl09-esc01-verificacion-salidas | LevelScene | — | lvl09-cin01-hallazgo-salida-y-mordida-selene | Flat snapshot; no image evidence |
| CI shard 2 | Pending | lvl09-cin01-hallazgo-salida-y-mordida-selene | CinematicScene | — | lvl09-cin02-traicion-de-selene-y-huida | Flat snapshot; no image evidence |
| CI shard 2 | Pending | lvl09-cin02-traicion-de-selene-y-huida | CinematicScene | — | lvl10-esc01-garage-busqueda-vehiculo | Flat snapshot; no image evidence |
| CI shard 2 | Pending | lvl10-esc01-garage-busqueda-vehiculo | LevelScene | — | lvl10-cin01-hallazgo-del-vehiculo | Flat snapshot; no image evidence |
| CI shard 2 | Pending | lvl10-cin01-hallazgo-del-vehiculo | CinematicScene | — | lvl10-esc02-resistencia-en-garage | Flat snapshot; no image evidence |
| CI shard 3 | Pending | lvl10-esc02-resistencia-en-garage | LevelScene | — | lvl10-cin02-salida-del-garage | Flat snapshot; no image evidence |
| CI shard 3 | Pending | lvl10-cin02-salida-del-garage | CinematicScene | — | lvl10-cin01-traslado-silencioso-plaza-de-mayo | Flat snapshot; no image evidence |
| CI shard 3 | Pending | lvl10-cin01-traslado-silencioso-plaza-de-mayo | CinematicScene | — | lvl10-esc01-combate-50-bajas-en-via-publica | Flat snapshot; no image evidence |
| CI shard 3 | Pending | lvl10-esc01-combate-50-bajas-en-via-publica | LevelScene | eliminar_50_zombies_independencia | lvl10-cin02-cierre-duo-final-en-san-telmo | Flat snapshot; no image evidence |
| CI shard 3 | Pending | lvl10-cin02-cierre-duo-final-en-san-telmo | CinematicScene | — | lvl10-esc03-llegada-a-san-telmo | Flat snapshot; no image evidence |
| CI shard 3 | Pending | lvl10-esc03-llegada-a-san-telmo | LevelScene | — | lvl10-cin03-desenlace-abierto | Flat snapshot; no image evidence |
| CI shard 3 | Pending | lvl10-cin03-desenlace-abierto | CinematicScene | — | campaign-end | Flat snapshot; no image evidence |
| CI shard 3 | Pending | campaign-end | CinematicScene | — | completion + menu | Flat snapshot; no image evidence |

## Manual acceptance passes

Validate keyboard/controller controls, pause freezing canonical timers, defeat/checkpoint recovery, reload/Continue, a post-completion New game, HUD weapon slots and objective toast, minimap marker cleanup, environmental/audio-loop cleanup, legible recovery errors, load timing, and the final return to menu. Record observations as text only.
