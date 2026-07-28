# Matriz de cobertura de combate

Fuente de verdad: `CombatProfiles.ts`, wrappers canónicos y `spawn_zones` de cada runtime. Todos bloquean la salida sólo cuando su objetivo runtime lo exige; la dificultad Pesadilla conserva el escalado existente de cantidad/cooldown.

| nodeId | runtimeLevelId | perfil / razón narrativa | systems / zonas | inicial / oleadas / min–max | aparición / finalización / bloquea salida |
|---|---|---|---|---|---|
| lvl01-esc01-comedor-resistencia | level_1_comedor_resistencia | resistance-small / resistencia inicial | runtime-spawn-manager / 2 | 0 / 2 / 1–8 | proximidad / limpiar / sí |
| lvl01-esc02-pasillos-hacia-escaleras-pb | level_1_pasillos_escaleras_pb | corridor-pressure / retirada | runtime-spawn-manager / 2 | 0 / 2 / 1–8 | zona / objetivo / sí |
| lvl02-esc01-hall-planta-baja | level_2_hall_planta_baja | hall-clearance / asegurar hall | runtime-spawn-manager / 2 | 0 / 2 / 1–10 | hall / limpiar / sí |
| lvl03-esc01-segundo-piso | level_3_segundo_piso | floor-ambush / emboscada | runtime-spawn-manager / 2 | 0 / 2 / 1–10 | sector / limpiar / sí |
| lvl04-esc01-tercer-piso | level_4_tercer_piso | floor-ambush / búsqueda | runtime-spawn-manager / 2 | 0 / 2 / 1–10 | sector / limpiar / sí |
| lvl05-esc01-cuarto-piso-comedor | level_4_oficina_422_comedor_escaleras | office-sweep / barrido | runtime-spawn-manager / 1 | 0 / 2 / 1–11 | centro / presupuesto / no |
| lvl06-esc01-quinto-piso-pertenencias | level_5_oficinas_selene_descenso | floor-ambush / pertenencias | runtime-spawn-manager / 1 | 0 / 2 / 1–11 | centro / presupuesto / no |
| lvl07-esc01-oficina-422-rescate | level_6_pasillos_planta_baja_salidas | rescue-pressure / rescate | runtime-spawn-manager / 1 | 0 / 2 / 1–11 | aproximación / rescate / no |
| lvl08-esc01-descenso-con-temporizador | level_8_pasillo_subsuelo2_escaleras_subsuelo3 | timed-descent-pursuit / persecución | runtime-spawn-manager / 1 | 0 / 1 / 1–6 | escalera / exit o timeout / no |
| lvl09-esc01-verificacion-salidas | level_9_verificacion_salidas | exit-verification / inspección | runtime-spawn-manager / 1 | 0 / 2 / 1–11 | centro / salidas / no |
| lvl10-esc01-garage-busqueda-vehiculo | level_9_subsuelo3_garage_salida | garage-search / alerta | runtime-spawn-manager / 1 | 0 / 2 / 1–11 | garage / vehículo / no |
| lvl10-esc02-resistencia-en-garage | level_9_subsuelo3_garage_salida | garage-defense / defensa | runtime-spawn-manager / 1 | 0 / 2 / 1–11 | garage / resistencia / sí |
| lvl10-esc01-combate-50-bajas-en-via-publica | level_10_exterior_urbano | street-horde / combate final | runtime-spawn-manager / 1 | 0 / 2 / 1–11 | calle / objetivo / sí |
| lvl10-esc03-llegada-a-san-telmo | level_10_llegada_san_telmo | san-telmo-approach / amenaza final acotada | runtime-spawn-manager / 1 | 0 / 2 / 1–11 | aproximación / llegada / no |

No hay nodos `level` con perfil `none`; cinemáticas y diálogos quedan fuera del sistema de combate.
