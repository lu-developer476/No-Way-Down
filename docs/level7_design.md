# Nivel 7 — Diseño técnico breve (quinto piso)

## 1) Concepto del nivel
Nivel 7 representa un **quinto piso técnico-administrativo** con progresión lineal por corredor largo y aperturas laterales. El loop principal combina:
1. limpieza de zonas de combate,
2. desbloqueo de checkpoints narrativos de recuperación,
3. cierre con llamada/cinemática para reencaminar la historia al 4° piso.

La estructura de datos base del layout vive en `level7_quinto_piso.json` (secciones, spawns, zonas, checkpoints, objetos interactivos y trigger final). 

## 2) Áreas del quinto piso
Áreas definidas por secciones `S1..S11`:
- **S1** acceso por escaleras.
- **S2** inicio del pasillo.
- **S3** Desarrollo (checkpoint narrativo 1).
- **S4** tramo medio del pasillo.
- **S5** Servicios de Comunicaciones (checkpoint narrativo 2).
- **S6** conexión a Instalación e Implementación.
- **S7** sector de Equipamiento.
- **S8** baños.
- **S9** cocina pequeña.
- **S10** puestos de guardia.
- **S11** punto de cinemática final.

## 3) Flujo narrativo (implementado)
### Flujo por objetivos (data-driven)
La cadena de objetivos define este orden:
1. llegar al quinto piso,
2. avanzar a Desarrollo,
3. completar checkpoint 1,
4. avanzar a Comunicaciones,
5. completar checkpoint 2,
6. disparar cinemática de llamada,
7. objetivo manual de rescate en 4° piso.

### Relación combate → checkpoint → cinemática
- `Level7CombatSystem` puede bloquear checkpoints narrativos por zona (`narrative_gate.blocksUntilCleared`).
- `NarrativeCheckpointSystem` espera resolución de combate antes de ejecutar recuperación.
- `CinematicCallSystem` se dispara por checkpoint y actualiza objetivo al final de diálogo.
- `Level7ObjectiveChain` consume eventos (`section-entered`, `checkpoint-completed`, `combat-zone-cleared`, `cinematic-played`, `manual`).

> Estado actual del repo: esta integración completa aparece en `game/src/examples/level7ObjectiveChainExample.ts` (ejemplo de referencia). En `GameScene` sí existe integración real de `NarrativeCheckpointSystem`, pero con configuración de ejemplo y callbacks simplificados.

## 4) Checkpoints
Checkpoints narrativos configurados actualmente:
- **cp7-desarrollo-recuperar-pertenencias** (Área de Desarrollo).
- **cp7-comunicaciones-recuperar-pertenencias** (Servicios de Comunicaciones).

Cada checkpoint define:
- `area` (rectángulo de activación),
- `objectiveOnComplete`,
- `recoveryEventId`,
- `participants`,
- `metadata.storyBeat`.

## 5) Sistemas utilizados
### Núcleo de nivel 7
- `Level7CombatSystem.ts`: traduce layout + zonas a `LevelProgressionSystem`, maneja bloqueo/desbloqueo narrativo y progreso global.
- `NarrativeCheckpointSystem.ts`: activa checkpoints por overlap, controla estados (`idle`, `awaiting_combat_resolution`, `recovering`, `completed`) y persiste snapshot en `registry`.
- `CinematicCallSystem.ts`: reproduce secuencia de diálogo por checkpoint, lock de movimiento opcional y actualización de objetivo.
- `Level7ObjectiveChain.ts`: máquina de estados para objetivos secuenciales del nivel.

### Complementario
- `BelongingsRecoverySystem.ts`: sistema genérico para objetos recuperables por actor/checkpoint (útil para profundizar mecánica de pertenencias).

## 6) Archivos JSON involucrados
### Runtime/flujo principal nivel 7
- `game/public/assets/levels/level7_quinto_piso.json`
  - Layout completo (secciones, spawns, zonas de combate, checkpoints, objetos interactivos, cinemática final).
- `game/public/assets/levels/level7_combat_system.json`
  - Definición de zonas de combate para `Level7CombatSystem` (triggers, waves, lock mode, narrative gates).
- `game/public/assets/levels/level7_narrative_checkpoints.json`
  - Definición de checkpoints narrativos para `NarrativeCheckpointSystem`.
- `game/public/assets/levels/level7_cinematic_call.json`
  - Configuración de llamadas/cinemáticas de diálogo por checkpoint.
- `game/public/assets/levels/level7_objective_chain.json`
  - Secuencia de objetivos del nivel 7.

### Soporte de recuperación de pertenencias
- `game/public/assets/levels/level7_belongings.json`
  - Configuración para `BelongingsRecoverySystem` (área, checkpoints, recuperables y reglas por actor).

### JSONs auxiliares en raíz del repo (referencia de diseño)
- `game/config/levels/level7/level7_areas.json`
- `game/config/levels/level7/level7_secondary_spaces.json`
- `game/config/levels/level7/level7_security_posts.json`

Estos tres no están conectados directamente en los ejemplos/sistemas TS revisados; sirven como insumo documental/prototipo de datos.

## 7) Archivos TypeScript involucrados
### Sistemas
- `game/src/systems/Level7CombatSystem.ts`
- `game/src/systems/NarrativeCheckpointSystem.ts`
- `game/src/systems/CinematicCallSystem.ts`
- `game/src/systems/Level7ObjectiveChain.ts`
- `game/src/systems/BelongingsRecoverySystem.ts`

### Integración / referencia
- `game/src/examples/level7CombatSystemExample.ts` (combate + checkpoints narrativos).
- `game/src/examples/level7ObjectiveChainExample.ts` (pipeline completo: combate + checkpoints + cinemática + objetivos).
- `game/src/scenes/GameScene.ts` (integración activa de `NarrativeCheckpointSystem` con config de nivel 7, actualmente como ejemplo de uso).

## 8) Cómo extender el nivel más adelante
Sin romper lo actual, se recomienda:

1. **Agregar contenido por datos, no por hardcode**
   - Nuevas zonas en `level7_combat_system.json`.
   - Nuevos beats narrativos en `level7_narrative_checkpoints.json`.
   - Nuevos objetivos en `level7_objective_chain.json`.

2. **Mantener consistencia de IDs entre archivos**
   - `checkpointId` debe coincidir entre combat gates, narrative checkpoints, cinemáticas y objective chain.
   - Validar que `section_id` y `spawn_ids` referencien entradas existentes del layout.

3. **Aprovechar `BelongingsRecoverySystem` si se quiere más profundidad de recuperación**
   - Migrar recuperación "simulada" por callback a recuperación por objetos reales (`recoverables`) con tiempos de interacción por actor.

4. **Consolidar integración en escena final de juego**
   - Tomar `level7ObjectiveChainExample.ts` como blueprint para mover el flujo completo a la escena productiva (no sólo ejemplo).

5. **Persistencia/telemetría mínima recomendada**
   - Guardar snapshots de `level7CombatProgress`, estado de checkpoints narrativos y estado del objective chain en `registry`/API para reanudación robusta.
