# Nivel 9 — Assets pendientes

Este documento lista los assets pendientes para producción del Nivel 9, organizados por categoría.

## pasillos del piso 1

| nombre | uso | prioridad | placeholder actual |
|---|---|---|---|
| Modular corredor piso 1 (recto/esquina/T) | Construcción de rutas internas y loops de persecución | Alta | `tile_hall_generic_lvl7` |
| Kit de escombros de pasillo (papeles, vidrios, sillas) | Variación visual y cobertura ligera en combate | Media | `prop_debris_small_a` |
| Iluminación de emergencia intermitente | Guiar ritmo de tensión y visibilidad limitada | Alta | `fx_light_blink_red_temp` |

## Planta Baja

| nombre | uso | prioridad | placeholder actual |
|---|---|---|---|
| Lobby PB destruido (set modular) | Zona de transición previa a salida principal | Alta | `scene_lobby_blockout_v2` |
| Mostrador recepción colapsado | Cobertura y storytelling ambiental | Media | `prop_counter_lowpoly` |
| Piso de mármol agrietado con decals | Señal de deterioro estructural | Media | `mat_floor_cracked_temp` |

## puertas giratorias

| nombre | uso | prioridad | placeholder actual |
|---|---|---|---|
| Puerta giratoria principal (animable) | Obstáculo dinámico durante escape y embotellamiento IA | Alta | `door_revolving_proxy` |
| Variante puerta giratoria trabada | Evento de bloqueo forzado en ruta crítica | Alta | `door_revolving_static_broken` |

## persianas bajas

| nombre | uso | prioridad | placeholder actual |
|---|---|---|---|
| Persianas metálicas medio cerradas | Restringir líneas de visión y rutas de escape | Alta | `shutter_metal_temp01` |
| Animación de persiana cayendo | Beat de cierre repentino en cinemática/juego | Alta | `anim_shutter_drop_stub` |

## señales de salidas A, B, C, D y E

| nombre | uso | prioridad | placeholder actual |
|---|---|---|---|
| Señal iluminada “Salida A” | Orientación de navegación y objetivos dinámicos | Alta | `sign_exit_generic_green` |
| Señal iluminada “Salida B” | Orientación de navegación y objetivos dinámicos | Alta | `sign_exit_generic_green` |
| Señal iluminada “Salida C” | Orientación de navegación y objetivos dinámicos | Alta | `sign_exit_generic_green` |
| Señal iluminada “Salida D” | Orientación de navegación y objetivos dinámicos | Alta | `sign_exit_generic_green` |
| Señal iluminada “Salida E” | Orientación de navegación y objetivos dinámicos | Alta | `sign_exit_generic_green` |

## caos exterior hacia Plaza de Mayo

| nombre | uso | prioridad | placeholder actual |
|---|---|---|---|
| Barricadas improvisadas y fuego urbano | Composición del escenario exterior y riesgo ambiental | Alta | `ext_barricade_blockout` |
| Multitud en pánico (siluetas/Lod crowds) | Sensación de colapso social en plano general | Alta | `npc_crowd_proxy_cards` |
| Vehículos abandonados dañados | Obstáculos y cobertura en avance final | Media | `car_shell_temp_set` |

## escaleras a subsuelos

| nombre | uso | prioridad | placeholder actual |
|---|---|---|---|
| Tramo de escalera descendente modular | Transición jugable hacia subsuelos | Alta | `stairs_concrete_proxy` |
| Señalética de subsuelo y numeración (-1/-2) | Claridad espacial y orientación narrativa | Media | `sign_basement_temp` |
| Puerta corta fuego de acceso a subsuelo | Gate de progresión y control de encuentros | Alta | `door_fire_exit_temp` |

## vísceras y destrucción ambiental

| nombre | uso | prioridad | placeholder actual |
|---|---|---|---|
| Decals de sangre arrastrada y salpicaduras | Refuerzo del tono trágico y dirección implícita | Alta | `decal_blood_generic_01` |
| Malla de restos orgánicos (set A/B/C) | Set dressing gore en puntos de impacto | Media | `gore_chunk_proxy` |
| Columnas/paredes fracturadas con polvo | Lectura de daño masivo del entorno | Media | `env_damage_crack_temp` |

## FX de cinemáticas trágicas

| nombre | uso | prioridad | placeholder actual |
|---|---|---|---|
| FX de humo denso con chispas | Fondo de caos en secuencias de pérdida | Alta | `fx_smoke_loop_temp` |
| Explosión distante con onda de polvo | Beat dramático en transición de escenas | Alta | `fx_explosion_stub` |
| Partículas de ceniza persistente | Continuidad visual de desastre | Media | `fx_ash_particles_temp` |

## UI de pérdidas de grupo

| nombre | uso | prioridad | placeholder actual |
|---|---|---|---|
| Widget “miembro perdido” | Notificar bajas críticas durante escape | Alta | `ui_alert_generic_red` |
| Timeline de estado del grupo | Mostrar degradación progresiva del equipo | Alta | `ui_party_status_temp` |
| Overlay de estrés crítico | Feedback visual en momentos límite | Media | `ui_vignette_damage_temp` |

## audio ambiente y tensión final

| nombre | uso | prioridad | placeholder actual |
|---|---|---|---|
| Loop ambiente interior colapsado | Base sonora de tensión en interiores | Alta | `amb_indoor_wind_temp.wav` |
| Capa de pánico exterior (gritos/sirenas) | Escala de caos hacia Plaza de Mayo | Alta | `amb_city_chaos_temp.wav` |
| Stingers de pérdida y desesperación | Énfasis emocional en eventos clave | Alta | `stinger_tragedy_stub.wav` |
| Riser final de escape fallido | Build-up previo al descenso a subsuelos | Alta | `music_riser_temp_01.wav` |
