# Nivel 4 — Assets pendientes (visuales y audio)

Documento de planificación para **assets pendientes** del Nivel 4.  
Objetivo: identificar qué recursos se necesitarán más adelante para producción final, **sin crearlos en esta etapa**.

## Criterios de prioridad
- **Alta**: bloquea lectura visual, navegación, feedback de combate o comprensión de objetivo.
- **Media**: mejora claridad y atmósfera, pero el nivel se puede jugar con fallback.
- **Baja**: pulido estético/narrativo no bloqueante.

## Arquitectura
| Nombre | Tipo | Uso en gameplay | Prioridad | Placeholder actual |
|---|---|---|---|---|
| Tileset modular institucional segundo piso (pisos/paredes/zócalos) | Visual (tileset 2D) | Define colisiones visuales, lectura de pasillos y navegación principal del Nivel 4 | Alta | Sí (`institutional_upper_floor_tileset_placeholder`) |
| Panel mural de mármol institucional | Visual (prop estático) | Delimita áreas internas y refuerza silueta de cobertura lateral | Media | Sí (`marble_wall_panel_a`) |
| Baranda/balustrada de planta alta | Visual (prop estático) | Marca bordes de altura y evita confusión de tránsito en balconeo interior | Media | Sí (`upper_floor_balustrade_a`) |

## Escaleras
| Nombre | Tipo | Uso en gameplay | Prioridad | Placeholder actual |
|---|---|---|---|---|
| Escalera curva monumental (tramo A/B/C) | Visual (sprites/tiles modulares) | Lectura del ascenso zig-zag y orientación espacial en sección S1 | Alta | Sí (`curved_stone_stairs_a`) |
| Variantes de descanso/rellano con terminaciones | Visual (tiles de transición) | Señaliza pausas tácticas y puntos de combate intermedio | Media | Parcial (se usan piezas de escaleras genéricas) |

## Molinetes
| Nombre | Tipo | Uso en gameplay | Prioridad | Placeholder actual |
|---|---|---|---|---|
| Molinete metálico bancario (idle/bloqueado/habilitado) | Visual (sprite con estados) | Comunica bloqueo de acceso y progresión por objetivo/credencial | Alta | Sí (`turnstile_bank_metal_a`) |
| Indicador visual de estado del molinete (luz roja/verde) | Visual (FX/UI in-world) | Feedback inmediato de interacción válida/inválida | Alta | No |

## Columnas
| Nombre | Tipo | Uso en gameplay | Prioridad | Placeholder actual |
|---|---|---|---|---|
| Columna de piedra institucional (entera) | Visual (prop estático) | Cobertura táctica y corte de líneas de tiro/visión | Alta | Sí (spritesheet de stone columns) |
| Columna dañada/impactada | Visual (variante de daño) | Telegráfica de zonas de combate intenso y legibilidad de riesgo | Media | Parcial (damage tiles genéricos de zombie) |

## Puertas
| Nombre | Tipo | Uso en gameplay | Prioridad | Placeholder actual |
|---|---|---|---|---|
| Puerta institucional interior bloqueada | Visual (sprite con estados) | Marca rutas no disponibles y guía flujo hacia objetivos activos | Alta | Parcial (evento `puertas-trabadas` sin arte dedicado) |
| Puerta vidriada de salida urbana | Visual (sprite/prop interactivo) | Hito final de objetivo y transición de nivel | Alta | Sí (`urban_exit_glass_door_a`) |

## Fondo interior
| Nombre | Tipo | Uso en gameplay | Prioridad | Placeholder actual |
|---|---|---|---|---|
| Fondo de hall superior con profundidad (capas) | Visual (parallax/capas de fondo) | Refuerza escala del segundo piso y orientación espacial | Media | No |
| Ventanales altos con iluminación exterior | Visual (tileset/prop repetible) | Referencia direccional hacia salida y lectura de borde superior | Media | Sí (tall windows spritesheet) |
| Señalética institucional segundo piso | Visual (prop decorativo funcional) | Ayuda navegación diegética (dirección de salida/sector) | Media | Sí (`carteleria_institucional_segundo_piso_placeholder`) |
| Escultura/elemento icónico de hall secundario | Visual (set piece) | Punto de referencia para callouts de combate cooperativo | Baja | Sí (`escultura_hall_secundario_placeholder`) |

## Transición al exterior
| Nombre | Tipo | Uso en gameplay | Prioridad | Placeholder actual |
|---|---|---|---|---|
| Vista exterior urbana desde ventanales/puerta | Visual (backdrop) | Anticipa extracción y mejora lectura narrativa de progreso | Media | No |
| Efecto de luz exterior invasiva (interior→exterior) | Visual (FX de iluminación) | Señaliza cercanía de salida y cambio de contexto | Alta | No |
| Overlay de transición final de nivel | Visual (FX/postproceso) | Clarifica momento de cambio de escena al salir | Alta | No |

## Zombies
| Nombre | Tipo | Uso en gameplay | Prioridad | Placeholder actual |
|---|---|---|---|---|
| Variante zombie “runner” para espacios abiertos de S4 | Visual (animaciones personaje) | Diferencia amenaza rápida en corredores largos | Alta | Sí (se utiliza set base de zombies) |
| Variante zombie “crawler” de presión en rellanos | Visual (animaciones personaje) | Aumenta presión en coberturas bajas y transiciones | Media | Sí (se utiliza set base de zombies) |
| Variantes de daño específicas de entorno institucional | Visual (overlays/decal de daño) | Refuerza feedback de combate y persistencia de enfrentamientos | Media | Parcial (institutional_zombie_damage_tilesheet) |

## FX
| Nombre | Tipo | Uso en gameplay | Prioridad | Placeholder actual |
|---|---|---|---|---|
| Luces parpadeantes de tramo interior | Visual (FX dinámico) | Refuerza eventos ambientales y lectura de peligro | Media | Sí (evento `luces-parpadeantes` con fallback) |
| Chispas/fallo eléctrico en zona de molinetes | Visual (FX puntual) | Enfatiza bloqueo y estado crítico de acceso | Media | No |
| Polvo/partículas en escaleras y rellanos | Visual (FX ambiental) | Aporta profundidad y movimiento sin afectar gameplay base | Baja | No |
| Resalte visual de trigger de combate/objetivo | Visual (FX gameplay) | Mejora claridad de activación de zonas de combate | Alta | Parcial (feedback textual/eventos) |

## Audio ambiente
| Nombre | Tipo | Uso en gameplay | Prioridad | Placeholder actual |
|---|---|---|---|---|
| Loop de eco interior de edificio | Audio (ambiente loop) | Construye atmósfera y continuidad sonora del nivel | Media | Sí (`level4-echo-loop`) |
| Alarma lejana intermitente | Audio (ambiente/one-shot) | Incrementa tensión en tramos medios | Media | Sí (`level4-distant-alarm`) |
| Puertas trabadas / metal forzado | Audio (SFX contextual) | Feedback diegético de rutas cerradas | Alta | Sí (`level4-locked-doors`) |
| Multitudes y caos exterior amortiguado | Audio (ambiente direccional) | Anticipa salida y conecta interior con exterior | Alta | Sí (`level4-outside-crowd`) |
| Capa de tensión cerca de salida | Audio (stinger/loop corto) | Comunica proximidad de objetivo final | Alta | Sí (`level4-exit-tension`) |

## Notas
- Este listado separa requerimientos de arte/sonido de la implementación de lógica.
- “Placeholder actual” indica si ya existe un recurso temporal o fallback utilizable en el proyecto.
- Recomendación: priorizar producción en este orden: **arquitectura/escaleras/puertas/molinetes**, luego **audio y FX críticos**, y por último pulido de fondo/variantes.
