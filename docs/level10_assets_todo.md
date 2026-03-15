# Nivel 10 — Assets pendientes

Este documento lista los assets pendientes para el **Nivel 10**, con su uso previsto, prioridad y el placeholder actual.

| Categoría | Nombre | Uso | Prioridad | Placeholder actual |
|---|---|---|---|---|
| estacionamiento del 3° subsuelo | Módulo de estacionamiento B3 (layout + señalética) | Escenario principal del nivel; define circulación, coberturas y puntos de aparición de enemigos. | Alta | Blockout gris con cajas de colisión básicas y texturas checker. |
| vehículos decorativos | Set de autos estáticos dañados (compacto, sedán, utilitario) | Dressing ambiental para reforzar narrativa de abandono y aportar obstáculos visuales. | Media | Mallas proxy de cubos escalados sin materiales finales. |
| vehículos interactivos | Autos interactivos (capó/puertas, alarmas, colisión dinámica) | Elementos jugables para distracción, cobertura temporal o activación de eventos. | Alta | Blueprint temporal con malla placeholder de hatchback y sonido genérico. |
| auto de escape | Vehículo de escape del clímax | Objetivo narrativo y mecánico para transición al cierre del nivel. | Crítica | Sedán placeholder reutilizado del Nivel 03 sin damage states. |
| luces y parpadeos | Sistema de luminarias B3 (fluorescentes, emergencia, flicker) | Atmósfera de tensión, guía visual y ritmos de peligro. | Alta | Luces puntuales básicas con script de parpadeo global uniforme. |
| camioneta del evento de mordida | Camioneta siniestrada del set-piece de mordida | Disparador visual/cinemático del evento y cobertura parcial durante combate. | Alta | Pickup genérica low-poly con material plano y sin rig de deformación. |
| FX de defensa de horda | FX de combate masivo (impactos, humo, chispas, sangre estilizada) | Feedback visual durante la defensa contra horda y lectura de intensidad del combate. | Crítica | Niagara/VFX placeholder de impactos del Nivel 07, sin variante de horda. |
| UI de temporizador de 10 minutos | Widget HUD de cuenta regresiva 10:00 | Control de fase principal del objetivo de defensa extendida. | Crítica | Texto debug en esquina superior izquierda. |
| UI de temporizador de 2 minutos | Widget HUD de cuenta regresiva 2:00 (fase final) | Escalado de urgencia y transición a secuencia de escape. | Crítica | Reutiliza timer debug sin estilo diferencial ni alerta sonora. |
| efectos de infección | FX de infección (postproceso, partículas, pulsos en pantalla) | Comunicar progresión de infección del personaje y aumentar presión dramática. | Alta | Vignette temporal + overlay rojo estático al 40%. |
| calle rumbo a San Telmo | Segmento exterior de calle (set dressing + iluminación) | Tramo de salida que conecta parking con ruta narrativa hacia San Telmo. | Media | Whitebox de calle con edificios bloque y skybox por defecto. |
| auto en movimiento | Vehículo en movimiento (animación/rig + path) | Evento de mundo vivo en la secuencia de salida y sensación de continuidad urbana. | Media | Malla de auto con spline simple y velocidad constante sin suspensión. |
| FX de final abierto | FX final (niebla, luces distantes, transición visual) | Cierre ambiguo del nivel y puente emocional al siguiente capítulo. | Alta | Fade out básico a negro sin capas atmosféricas. |
| audio ambiente y tensión final | Paisaje sonoro B3 + capa de tensión final musical/SFX | Sostener inmersión, anticipación y clímax emocional del cierre. | Crítica | Loop ambiente genérico de parking + stinger temporal único. |

## Notas de priorización

- **Crítica**: necesario para validar flujo principal, clímax y salida del nivel.
- **Alta**: impacta fuertemente jugabilidad, narrativa o legibilidad de la experiencia.
- **Media**: mejora de inmersión y acabado, sin bloquear pruebas funcionales del nivel.
