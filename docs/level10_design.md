# Nivel 10 — documentación técnica de diseño (estado implementado)

> Objetivo de este documento: servir como guía de mantenimiento del **cierre del juego** en el Nivel 10 sin introducir cambios que rompan la secuencia final.

## 1) Resumen narrativo del nivel final

El Nivel 10 está implementado como una cadena de sistemas desacoplados que modelan:

1. llegada al estacionamiento del subsuelo,
2. exploración de vehículos y recursos,
3. evento de mordida de una gemela,
4. defensa principal de 10 minutos,
5. progresión de infección,
6. colapso final de las gemelas,
7. salida en vehículo,
8. trayecto hacia San Telmo,
9. combate final de 2 minutos,
10. cinemática de final abierto.

La progresión narrativa no depende de una sola clase monolítica: se reparte en `Level10NarrativeSystem`, `Level10ObjectiveChain` y sistemas especializados (cinemáticas, supervivencia, infección y defensa final).

---

## 2) Estructura del estacionamiento

La estructura lógica del estacionamiento en Nivel 10 combina:

- **layout de recorrido** (documentado en ASCII),
- **vehículos con estado** (decorativos/interactivos/escape),
- **zonas de presión de combate** alrededor del auto de salida,
- **triggers narrativos** (intro, mordida, transición de escape).

Referencia visual/operativa del layout:

- `docs/level10_parking_escape_ascii_layout.md`

Modelo de exploración y recursos:

- `assets/levels/level10_parking_exploration.json`

Modelo de supervivencia en estacionamiento:

- `game/config/levels/level10/level10_parking_survival.json`

---

## 3) Sistema de vehículos interactivos

En el repo conviven dos capas de vehículos para Nivel 10:

### A. Capa de exploración narrativa del parking

Sistema: `Level10ParkingExplorationSystem`

- Distingue `interactive` vs `decorative`.
- Permite inspeccionar vehículos y recolectar recursos asociados.
- Soporta vehículos bloqueados por llave (`requiredKeyId`) y desbloqueo por recurso recolectado.

Archivo principal:

- `assets/levels/level10_parking_exploration.json`

### B. Capa genérica de interacción vehicular

Sistema: `VehicleInteractionSystem`

- Tipos soportados: `decorative`, `interactive-resource`, `locked-breakable`, `escape-usable`.
- Gestiona interacción, apertura forzada, loot y estado de vehículo de escape.

Archivo principal:

- `assets/levels/level10_vehicles.json`

### C. Tabla de loot por vehículo

Sistema: `VehicleLootSystem` (datos)

- Define loot probabilístico por vehículo (`lootTable`), con banderas como `keyForEscape`.

Archivo principal:

- `assets/levels/level10_vehicle_loot.json`

---

## 4) Evento de mordida

Sistema: `TwinBiteParkingCinematicSystem`

- Trigger configurado por `triggerId`.
- Ejecuta secuencia de acciones + diálogos.
- Dispara callbacks de alto impacto:
  - inicio de infección (`start_infection`),
  - activación de combate principal (`trigger_main_combat`),
  - definición de punto de reunión (`set_rally_point`),
  - activación explícita del sistema de defensa (`activate_defense_system`).

Archivo principal:

- `assets/levels/level10_twin_bite_event.json`

---

## 5) Defensa principal de 10 minutos

Hay dos piezas relacionadas:

### A. Encuentro de resistencia por duración

Sistema: `Level10ResistanceCombatSystem`

- Encuentro `defensa_auto_principal` con `durationMs = 600000`.

Archivo:

- `assets/levels/level10_resistance_encounters.json`

### B. Supervivencia del estacionamiento (oleadas + presión continua + eventos)

Sistema: `Level10ParkingSurvivalSystem`

- `durationMs = 600000` (10 min).
- Modo `hybrid`:
  - oleadas (`waves`) por ventanas temporales,
  - presión continua (`continuousPressure`) con intervalo dinámico.
- Expone timer, eventos narrativos one-shot e hitos de infección durante el aguante.

Archivo:

- `game/config/levels/level10/level10_parking_survival.json`

---

## 6) Progresión de infección

Sistema: `ProgressiveInfectionSystem`

- Duración total: 10 minutos (`totalDurationMs = 600000`).
- Autoarranque (`autoStart: true`).
- Etapas discretas con:
  - `thresholdMs`,
  - `severity`,
  - `visualCues`,
  - `behaviorFlags`,
  - `hudMessage`,
  - impactos de grupo (`groupImpact`),
  - hooks narrativos (`narrativeHooks`).

Archivo principal:

- `assets/levels/level10_infection_stages.json`

---

## 7) Colapso de las gemelas

Sistema: `TwinFinalCollapseCinematicSystem`

- Orquesta la cinemática post-defensa principal.
- Reglas relevantes del sistema:
  - elimina exactamente dos IDs de gemelas (`twinsRemovedFromGroup`),
  - deja exactamente dos supervivientes (`survivingGroupIds`),
  - habilita objetivo de escape en vehículo,
  - marca disparo final fuera de cámara como marcador narrativo (`offscreenGunshotMarkerId`).

Archivo principal:

- `assets/levels/level10_twin_final_dialogue.json`

---

## 8) Trayecto hacia San Telmo

Sistema: `DriveToSanTelmoCinematicSystem`

- Secuencia de beats de ruta + diálogo.
- Valida explícitamente que la emboscada esté a **2 cuadras** (`ambushTrigger.distanceToBarrioBlocks === 2`).
- Al finalizar prepara trigger de emboscada final.

Archivo principal:

- `assets/levels/level10_drive_to_santelmo_dialogue.json`

---

## 9) Combate final de 2 minutos

Sistema: `Level10FinalStreetHoldSystem`

- Defensa breve en calle con temporizador estricto de **120000 ms**.
- Limita combatientes válidos a 2 supervivientes (`survivors`).
- Maneja fases de spawn escaladas (`spawnPhases`).
- Al completar temporizador dispara trigger de cinemática final.

Archivo principal:

- `assets/levels/level10_final_street_hold.json`

> Nota de mantenimiento: el sistema valida `timer.durationMs === 120000`; no convertir este valor en configurable libre si se quiere conservar el cierre actual.

---

## 10) Final abierto

Sistema: `FinalOpenEndingCinematicSystem`

- Requiere secuencia con al menos un bloque de `silence`.
- Limita diálogo a máximo 2 líneas para mantener cierre sobrio.
- Exige estado final de campaña:
  - `campaignState.status = "completed"`
  - `campaignState.endingType = "open"`
- Publica `continuationHook` para continuidad narrativa.

Archivo principal:

- `game/config/levels/level10/level10_final_ending.json`

---

## 11) Archivos JSON implicados

### Núcleo de Nivel 10 (runtime)

- `assets/levels/level10_objective_chain.json`
- `assets/levels/level10_narrative_chain.json`
- `assets/levels/level10_parking_exploration.json`
- `game/config/levels/level10/level10_parking_survival.json`
- `assets/levels/level10_resistance_encounters.json`
- `assets/levels/level10_twin_bite_event.json`
- `assets/levels/level10_infection_stages.json`
- `assets/levels/level10_twin_final_dialogue.json`
- `assets/levels/level10_vehicles.json`
- `assets/levels/level10_vehicle_loot.json`
- `assets/levels/level10_drive_to_santelmo_dialogue.json`
- `assets/levels/level10_final_street_hold.json`
- `game/config/levels/level10/level10_final_ending.json`

### Referencia de layout/documentación

- `docs/level10_parking_escape_ascii_layout.md`

---

## 12) Archivos TypeScript implicados

### Orquestación narrativa y objetivos

- `game/src/systems/Level10NarrativeSystem.ts`
- `game/src/systems/Level10ObjectiveChain.ts`

### Exploración, vehículos y loot

- `game/src/systems/Level10ParkingExplorationSystem.ts`
- `game/src/systems/VehicleInteractionSystem.ts`
- `game/src/systems/VehicleLootSystem.ts`

### Combate/supervivencia

- `game/src/systems/Level10ParkingSurvivalSystem.ts`
- `game/src/systems/Level10ResistanceCombatSystem.ts`
- `game/src/systems/Level10FinalStreetHoldSystem.ts`

### Cinemáticas críticas del cierre

- `game/src/systems/TwinBiteParkingCinematicSystem.ts`
- `game/src/systems/TwinFinalCollapseCinematicSystem.ts`
- `game/src/systems/DriveToSanTelmoCinematicSystem.ts`
- `game/src/systems/FinalOpenEndingCinematicSystem.ts`

### Soporte narrativo adicional de Nivel 10

- `game/src/systems/Level10NarrativeSystem.ts`
- `game/src/systems/Level10ParkingIntroCinematicSystem.ts`

---

## 13) Cómo mantener el nivel sin romper el cierre del juego

Checklist práctico de mantenimiento:

1. **No romper IDs de enlace entre sistemas**
   - Si cambiás `triggerId`, `cinematicId`, `objectiveId`, `targetId` o `zoneId`, actualizá todas las referencias consumidoras.
   - Priorizar cambios atómicos: editar JSON + adapter/loader del sistema en el mismo commit.

2. **Conservar duraciones estructurales del cierre**
   - Defensa principal: 10 min (`600000 ms`).
   - Defensa final: 2 min (`120000 ms`, validado en `Level10FinalStreetHoldSystem`).
   - Si se altera tiempo narrativo, validar que eventos de infección y cinemáticas no queden desfasados.

3. **Respetar precondiciones validadas por los sistemas**
   - Muchos sistemas lanzan `Error` por config inválida (IDs duplicados, campos vacíos, etapas sin cues, etc.).
   - Antes de mergear cambios de JSON, ejecutar una corrida local que instancie los sistemas desde JSON.

4. **Mantener la secuencia de emboscada a dos cuadras**
   - `DriveToSanTelmoCinematicSystem` exige `distanceToBarrioBlocks === 2` para `ambushTrigger`.
   - Cualquier desviación rompe la validación y corta el flujo final.

5. **No introducir más supervivientes en el tramo final sin rediseño completo**
   - `TwinFinalCollapseCinematicSystem` y `Level10FinalStreetHoldSystem` están diseñados para cierre con 2 supervivientes.
   - Agregar un tercero exige actualizar: composición de grupo, combatientes permitidos, objetivos y cinemática final.

6. **Preservar contrato del final abierto**
   - `FinalOpenEndingCinematicSystem` requiere estado final `completed/open` y al menos un silencio estructurado.
   - Evitar sobrecargar de diálogo: el propio sistema fuerza tono de cierre sobrio.

7. **Alinear narrativa y objetivos**
   - Cuando se agregue o quite un beat en `level10_narrative_chain.json`, revisar si hay objetivo equivalente en `level10_objective_chain.json`.
   - Divergencias entre ambas cadenas producen HUD/meta inconsistente aunque el nivel “funcione”.

8. **Evitar mezclar responsabilidades en un solo sistema**
   - Mantener el patrón actual: exploración, infección, cinemática y supervivencia en sistemas separados.
   - Esto reduce regresiones en el cierre de juego al tocar una sola parte.

---

## 14) Notas de alcance (para evitar inventar features)

Este documento describe exclusivamente elementos ya representados en los JSON y en los sistemas TypeScript del repositorio.
No se asumen mecánicas adicionales (IA especial nueva, UI nueva o rutas alternativas nuevas) fuera de los contratos existentes.
