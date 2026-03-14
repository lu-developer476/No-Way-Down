# Nivel 5 — Assets pendientes

Inventario de assets pendientes para el **Nivel 5 (tercer piso institucional)**, organizado por categoría solicitada.

## Criterios de prioridad
- **Alta**: afecta lectura de navegación, combate o objetivo principal.
- **Media**: mejora claridad táctica y ambientación sin bloquear progreso.
- **Baja**: pulido estético/no crítico.

## arquitectura
| Nombre | Uso | Prioridad | Placeholder actual |
|---|---|---|---|
| Tramo de corredor de piedra angosto (modular) | Definir identidad del corredor final y lectura espacial de embudo táctico en S5 | Alta | `narrow_stone_corridor_section_placeholder` |
| Runner de piso institucional (detalle modular) | Marcar continuidad del anillo perimetral y orientar avance en S2 | Media | `institutional_floor_runner_a_placeholder` |
| Señalética direccional interior institucional | Apoyo de navegación diegética hacia extracción en S6 | Media | `interior_directional_signage_placeholder` |

## barandas
| Nombre | Uso | Prioridad | Placeholder actual |
|---|---|---|---|
| Baranda de seguridad interior en esquina | Delimitar borde de circulación y evitar confusión de tránsito en S1/S5 | Alta | `safety_railing_internal_corner_placeholder` |
| Baranda recta perimetral institucional | Lectura de borde seguro/expuesto del corredor y balcón en S2/S3 | Alta | `security_railing_straight_placeholder` |
| Segmento de baranda reforzada de balcón | Cobertura parcial y silueta táctica durante fuego cruzado en S3 | Alta | `institutional_balcony_railing_b_placeholder` |
| Portón/baranda de seguridad final | Comunicar cierre de extracción y progresión final en S6 | Alta | `final_security_railing_gate_placeholder` |

## columnas
| Nombre | Uso | Prioridad | Placeholder actual |
|---|---|---|---|
| Cluster de columnas de piedra (entrada) | Cobertura inicial y corte de línea de visión en S1 | Alta | `stone_column_cluster_a_placeholder` |
| Par de columnas de piedra (corredor) | Micro-coberturas en enfrentamientos lineales de S2 | Alta | `stone_column_pair_b_placeholder` |
| Serie longitudinal de columnas (galería) | Ritmo visual y coberturas alternadas en S3 | Alta | `stone_column_long_series_placeholder` |
| Columna cuadrada maciza (cobertura full) | Punto de anclaje defensivo en zona de balcón S3 | Media | `stone_column_square_placeholder` |

## puertas
| Nombre | Uso | Prioridad | Placeholder actual |
|---|---|---|---|
| Puerta doble de oficina institucional | Accesos funcionales del sector oficinas (abierta/bloqueada) en S4 | Alta | `double_office_door_institutional_placeholder` |
| Puerta de salida reforzada institucional | Hito de objetivo final y transición de nivel en S6 | Alta | `institutional_exit_door_reinforced_placeholder` |

## muebles
| Nombre | Uso | Prioridad | Placeholder actual |
|---|---|---|---|
| Archivador metálico institucional | Cobertura completa en pasillo S2 | Media | `archivador_metal_institucional_placeholder` |
| Banco de piedra de corredor | Cobertura parcial y variación de combate en S2 | Media | `bench_stone_corridor_placeholder` |
| Carro/document cart de oficina | Cobertura móvil visual y clutter táctico en S4 | Media | `document_cart_placeholder` |
| Gabinete/puesto de seguridad (checkpoint) | Cobertura full en antesala de extracción S6 | Alta | `security_checkpoint_cover_placeholder` |

## oficinas
| Nombre | Uso | Prioridad | Placeholder actual |
|---|---|---|---|
| Recepción de oficina institucional | Cobertura principal y lectura de nodo en combate por oficinas (S4) | Alta | `office_reception_desk_placeholder` |
| Archivador pétreo de archivo lateral | Refuerzo de fantasía administrativa e interrupción de visuales en S4 | Media | `stone_archive_cabinet_placeholder` |

## balcones
| Nombre | Uso | Prioridad | Placeholder actual |
|---|---|---|---|
| Segmento de balcón reforzado (cover half) | Soporte de combate en galería con exposición al hall en S3 | Alta | `balcony_railing_reinforced_segment_placeholder` |
| Tratamiento visual de bordes de balcón (módulo repetible) | Clarificar zonas transitables vs. vacío en `balcony_edges` de S3 | Alta | Parcial (`institutional_balcony_railing_b_placeholder`) |

## efectos de combate
| Nombre | Uso | Prioridad | Placeholder actual |
|---|---|---|---|
| FX de activación de zona de combate (inicio) | Señalizar de forma inequívoca que una `combat_zone` quedó activa | Alta | No (solo bloqueo/gameplay en sistema) |
| FX de limpieza de zona (completada) | Confirmar cierre de oleadas y habilitación de avance | Alta | No (feedback actual por hint de texto/debug) |
| FX de emboscada en balcón | Reforzar la acción `activate_balcony_ambush` de CZ3 | Media | No |
| FX de desbloqueo de oficinas tras combate | Visualizar `unlock_office_and_spawn_counterattack` de CZ4 | Media | No |

## audio ambiente
| Nombre | Uso | Prioridad | Placeholder actual |
|---|---|---|---|
| Loop/one-shot de hall central distante | Profundidad espacial cuando se dispara `sonidos-hall-central` | Media | No (evento con texto + audioKey opcional) |
| Pasos en pisos inferiores | Tensión fuera de cámara para evento `pasos-pisos-inferiores` | Media | No (marcas visuales + audioKey opcional) |
| Alarma interna de sector institucional | Escalada de peligro en `alarmas-internas` | Alta | No (overlay visual + audioKey opcional) |
| Golpes de puertas metálicas | Ambientación reactiva para `puertas-golpeandose` | Media | No (evento soportado, sin asset dedicado) |
| Zumbido/parpadeo eléctrico de luminarias | Complemento sonoro para `luces-parpadeantes` | Media | No (solo efecto visual procedural) |
