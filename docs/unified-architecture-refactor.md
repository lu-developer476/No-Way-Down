# Unified Architecture Refactor (Campaign Backbone)

## Auditoría inicial (resumen)

Problemas detectados en `game/src/systems`:

1. **Objetivos duplicados por nivel** (`MissionSystem`, `Level7ObjectiveChain`, `Level8ObjectiveChain`, `Level9ObjectiveChain`, `Level10ObjectiveChain`) con estados y reglas similares pero contratos distintos.
2. **Cinemáticas fragmentadas** con lógica repetida para lock de movimiento, secuencias de diálogo y callbacks narrativos (`Level8IntroCinematicSystem`, `SisterMessageCinematicSystem`, `ExitACinematicSystem`, `TwinBiteParkingCinematicSystem`, etc.).
3. **Combate/eventos con múltiples pipelines** (`ZombieWaveZone`, `Level4CombatSystem`, `Level6CombatSystem`, `Level7CombatSystem`, `Office422WaveCombatSystem`, `FlankingEscapeCombatSystem`) sin un estado de evento común.
4. **Estado de grupo/party disperso** (`AllySystem`, `RescuedAllyIntegrationSystem`, `IrreversibleLossEventSystem`) sin una fuente unificada para pérdidas permanentes/rescates/infección.
5. **Checkpoint/temporizador no unificado** (`NarrativeCheckpointSystem`, `TimedCheckpointSystem`) con snapshots incompatibles.
6. **Interacciones de vehículos/objetos en sistemas aislados** (`VehicleInteractionSystem`, `VehicleLootSystem`, sistemas de objetos por zona) sin base compartida.
7. **Sin estado global de campaña transversal** para nivel actual, flags irreversibles, cinemáticas vistas y progreso narrativo acumulado.

## Propuesta de arquitectura unificada

Se introdujo una **columna vertebral central** en `game/src/systems/core`:

- `CampaignState`: estado global de campaña.
- `ObjectiveSystem`: cadena de objetivos con estados `locked/active/completed/failed`.
- `CinematicSystem`: secuenciador único de cinemáticas (líneas + acciones + movement lock).
- `CombatEventSystem`: estado común para zonas/oleadas/cierre de combate.
- `PartyStateSystem`: composición de grupo, control humano/IA, pérdidas permanentes y estados narrativos.
- `CheckpointTimerSystem`: snapshots unificados de checkpoints y timers de misión.
- `InteractableSystem`: base común para interactuables (vehículos/objetos decorativos, bloqueados, rompibles, con loot y escape).

## Refactor aplicado

### Cambios estructurales
- `MissionSystem` ahora funciona como **adapter de compatibilidad** sobre `core/ObjectiveSystem`.
- `Level8IntroCinematicSystem` migrado al secuenciador `core/CinematicSystem` para eliminar lógica duplicada de espera/lock/diálogo.
- `GameScene` ahora inicializa y publica en registry:
  - `campaignState`
  - `partyState`
  y marca bajas permanentes al detectar derrota.

### Estado global de campaña (A)
`CampaignState` persiste:
- nivel actual
- progreso narrativo
- personajes activos
- muertos
- rescatados
- infectados
- eventos irreversibles
- recursos globales
- cinemáticas vistas

### Objective system unificado (B)
`ObjectiveSystem` soporta:
- `locked`, `active`, `completed`, `failed`
- condiciones múltiples (`all/any`)
- disparo por eventos desde combate/cinemáticas/checkpoints

### Cinematic system unificado (C)
`CinematicSystem` centraliza:
- diálogo secuencial
- actions steps
- bloqueo/desbloqueo de movimiento
- callbacks de inicio/fin y acciones

### Combat/Event system unificado (D)
`CombatEventSystem` agrega estado normalizado por zona:
- activación de zona
- inicio de oleadas
- spawn trigger
- cierre/limpieza

### Party/Group state unificado (E)
`PartyStateSystem` soporta:
- composición de grupo
- control humano/IA
- pérdida irreversible
- rescate
- infección
- remoción permanente

### Checkpoint/Timer unificado (F)
`CheckpointTimerSystem` soporta:
- checkpoints comunes/restaurados
- timers de misión
- snapshot único para HUD/progreso

### Vehicle/Interactable unificado (G)
`InteractableSystem` modela:
- decorativos
- interactivos
- bloqueados/rompibles
- con loot
- escape-ready

## Cómo agregar nuevos niveles sin duplicar lógica

1. Definir datos del nivel (JSON) y mantener la lógica de runtime en sistemas `core`.
2. Crear adapters del nivel sólo para traducir config JSON a eventos de `ObjectiveSystem`, `CombatEventSystem`, `CinematicSystem` y `CheckpointTimerSystem`.
3. Persistir cambios globales en `CampaignState` y `PartyStateSystem`.
4. Evitar crear nuevas variantes de cadena de objetivos/cinemática por nivel si el caso entra en el modelo core.

## Registro de muertes permanentes, rescates e infección

- Muerte permanente:
  - `partyState.markDead(memberId)`
  - `campaignState.applyPatch({ markDeadCharacter: memberId, markIrreversibleEvent: '...' })`
- Rescate:
  - `partyState.markRescued(memberId)`
  - `campaignState.applyPatch({ markRescuedCharacter: memberId, addActiveCharacter: memberId })`
- Infección:
  - `partyState.markInfected(memberId)`
  - `campaignState.applyPatch({ markInfectedCharacter: memberId })`

## Qué quedó bien unificado

- Base de estado de campaña, objetivos, cinemáticas, party, timers y interactuables ya existe y es reusable.
- `MissionSystem` y `Level8IntroCinematicSystem` usan backbone central sin romper contratos externos.
- `GameScene` publica estado de campaña/party en registry para HUD/sistemas existentes.

## Deuda técnica pendiente

1. Migrar `Level7/8/9/10ObjectiveChain` a adapters directos de `core/ObjectiveSystem`.
2. Integrar `NarrativeCheckpointSystem` y `TimedCheckpointSystem` sobre `core/CheckpointTimerSystem`.
3. Migrar más cinemáticas (`ExitA`, `SisterMessage`, `TwinBite`, etc.) al `core/CinematicSystem`.
4. Unificar sistemas de combate de niveles 4/6/7/8/9/10 sobre `core/CombatEventSystem` + `LevelProgressionSystem`.
5. Conectar `VehicleInteractionSystem` y `VehicleLootSystem` mediante `core/InteractableSystem` como única verdad.

## Recomendación de siguiente fase

- Fase 2: crear adapters por nivel para objetivos/combate/cinemáticas y deprecar clases duplicadas.
- Fase 3: consolidar persistencia en backend usando snapshot serializado de `CampaignState` + `PartyStateSystem`.
- Fase 4: eliminar sistemas legacy una vez que todos los niveles consuman los adapters core.


## Fase de alineación de contratos (runtime actual)

### Convención oficial de IDs (adoptada)

Para los assets narrativos activos se adopta convención **kebab-case** con prefijo de nivel y tipo:

- `level<N>-checkpoint-<slug>` para checkpoints narrativos.
- `level<N>-cinematic-<slug>` para cinemáticas.
- `level<N>-objective-<slug>` para objetivos serializados en JSON.

Esto evita colisiones y elimina mezclas de estilos (`cp7-*`, `level7-checkpoint-*`, `reach_office_422`).

### Fuente de verdad por dominio (hoy)

- **Objetivos de runtime jugable actual (`GameScene`)**: `game/src/scenes/GameScene.ts` (`MissionSystem` inline).
- **Checkpoints narrativos de Nivel 7**: `game/public/assets/levels/level7_narrative_checkpoints.json`.
- **Cinemáticas de llamada asociadas a checkpoints de Nivel 7**: `game/public/assets/levels/level7_cinematic_call.json`.
- **Composición inicial del grupo jugable actual**: `getActivePlayerConfigs()` + mapeo a `CampaignState` / `PartyStateSystem` en `GameScene`.
- **Persistencia de campaña en runtime actual**: `progressApi` + fallback `localStorage` para progreso básico (`current_level`, `life`, `checkpoint`).

### Runtime oficialmente soportado en esta etapa

Queda oficialmente soportado y alineado el loop real de `GameScene` (nivel base `level2_subsuelo`) con:

- combate base,
- objetivo principal del nivel,
- checkpoints narrativos cargados por JSON,
- cinemática de llamada por checkpoint,
- estado de party/campaña publicado en `registry`,
- persistencia básica de progreso.

### Sistemas existentes aún no integrados al loop oficial

Los sistemas/JSON avanzados de niveles posteriores se mantienen en el repositorio, pero **no se consideran aún fuente de verdad del runtime base** hasta su integración explícita por fase.

En particular, se elimina del `GameScene` actual el uso de narrativa de Level 8 para evitar referencias cruzadas de nivel mientras se completa la integración por adapters.
