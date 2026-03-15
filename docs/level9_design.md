# Nivel 9 — Diseño técnico para mantenimiento (fallas de escape y descenso final)

## 1) Resumen narrativo del nivel
El Nivel 9 implementa una secuencia de **escape frustrado + decisión de repliegue profundo**:

1. El grupo inicia en piso 1 y baja a planta baja.
2. Intenta la salida A y descubre que es una falsa esperanza.
3. Evalúa varias salidas en planta baja (B, C, D, E) con resultados distintos.
4. En salida B ocurre una pérdida irreversible.
5. Tras confirmar que la ruta exterior no es sostenible, el grupo decide bajar a subsuelos.
6. En 2° subsuelo ocurre una cinemática crítica de infección con pérdida de un miembro.
7. La recta final desemboca en un sacrificio final para habilitar el escape del resto.

La progresión principal está modelada en `level9_objective_chain.json` con objetivos encadenados por eventos (`exit-attempted`, `exit-evaluated`, `cinematic-played`, `group-escaped`, etc.).

---

## 2) Falsa salida en Planta Baja (salida A)
La salida A no se trata como ruta válida de escape real:

- La cinemática `level9_exit_a_false_hope` presenta una aparente salida a superficie y luego obliga al repliegue.
- Al completar esta cinemática se marca el backtrack desde A y se habilita la exploración del resto de salidas en el sistema de evaluación.
- El objective chain exige explícitamente:
  - intento de salida A (`exit-attempted: A`),
  - supervivencia de falsa salida (`cinematic-played: level9_exit_a_false_hope`).

En términos de mantenimiento: A es un **gate narrativo** para abrir el bloque de evaluación B/C/D/E, no una alternativa equivalente a las demás.

---

## 3) Sistema de múltiples salidas (B/C/D/E)
El comportamiento de planta baja se divide en dos capas:

1. **Evaluación de salidas (estado narrativo/decisión):**
   - `level9_exit_evaluation.json` define modo `semi_free`, orden sugerido (`B`, `C`, `D`, `E`) y requisitos para E (`requiresEvaluated: ["B", "C", "D"]`).
   - Cada salida publica outcomes de combate, narrativa y estado de ruta (`route_state`).

2. **Rutas y triggers diegéticos de salida:**
   - `game/config/levels/level9/level9_exit_routes.json` define para A-E estados iniciales, outcomes de inspección/activación y triggers (`zone_enter`, `interaction`, `activation`, etc.).

Adicionalmente, el combate táctico de flanqueo para C/D se configura en `game/config/levels/level9/level9_flank_combat_zones.json` y se integra mediante `FlankingEscapeCombatSystem` (encuentros `salida-c` y `salida-d`).

---

## 4) Pérdidas irreversibles
Hay pérdidas permanentes modeladas por datos y por sistemas:

- **Salida B (planta baja):**
  - `level9_exitB_loss_event.json` define evento inevitable (`unavoidable: true`) con dos bajas (`Tomás`, `Lucía`) al evaluar la ruta B.
  - `IrreversibleLossEventSystem` aplica remoción del squad en runtime y emite snapshot con `removedMemberIds`.
  - El objective chain valida esta fase con `permanent-loss-applied` y `minLosses: 1` sobre `exit_b_irreversible_loss`.

- **2° subsuelo y cierre final:**
  - `level9_subsuelo2_infection_dialogue.json` incluye una pérdida narrativa explícita en la cinemática de infección.
  - `level9_final_sacrifice.json` fuerza el sacrificio final de dos aliados concretos para habilitar transición de escape.

Para mantenimiento, tratar estas pérdidas como **estado persistente de narrativa**, no como meras variantes cosméticas.

---

## 5) Descenso a subsuelos
La decisión de bajar se activa luego de evaluar E y disparar la cinemática de cambio de plan:

- `level9_exitE_decision_dialogue.json` explicita que volver al 1° subsuelo se descarta y se impone bajar al 3° subsuelo (estacionamiento).
- El objective chain transiciona de `new_plan_cinematic` a `descend_to_basements` (`floor-reached: subsuelo_1`).

El descenso con presión está parametrizado en `level9_descent_pressure.json`:

- presión acumulada (`maxPressure`, `collapseThreshold`),
- segmentos ordenados,
- eventos por segmento (narrativos, combate, cinemáticas, fatiga),
- `finalSegmentId` para cierre del tramo.

`Level9DescentPressureSystem` procesa esos segmentos/eventos y publica snapshot en registry.

---

## 6) Cinemática del 2° subsuelo
La cinemática del 2° subsuelo se define en `level9_subsuelo2_infection_dialogue.json`:

- `cinematicId`: `level9_subsuelo2_infection_break`.
- Trigger explícito (`subsuelo2_infection_trigger`).
- Requisitos narrativos del miembro víctima (`victimMemberId` + `victimMustHaveStatus`).
- Diálogo secuencial con bloqueo de movimiento.
- Follow-up encounter opcional habilitado (`small-zombie-combat`).

`Subsuelo2InfectionCinematicSystem` encapsula esa secuencia y emite evento de cinemática completada para que el objective chain avance.

---

## 7) Sacrificio final
El cierre del nivel se apoya en `level9_final_sacrifice.json` y `FinalSacrificeSystem`:

- Trigger de esquina previa al acceso a 3° subsuelo.
- Bloqueo de movimiento + duración de “hold the line”.
- Lista explícita de aliados que se sacrifican (`bna_morocho`, `mejor_amigo_colorado`) y rasgos requeridos.
- Secuencia de diálogo.
- `escapeTransition.destination` para solicitar transición de escape del resto.

En la integración de ejemplo, al finalizar secuencia:

- se emite `cinematic-played` con `nivel9_sacrificio_final`,
- luego `group-escaped` con el `destination` de transición.

---

## 8) Archivos JSON implicados
### Núcleo de progresión y narrativa (assets del juego)
- `game/public/assets/levels/level9_objective_chain.json`
- `game/public/assets/levels/level9_exit_evaluation.json`
- `game/public/assets/levels/level9_exitA_dialogue.json`
- `game/public/assets/levels/level9_exitB_loss_event.json`
- `game/public/assets/levels/level9_exitE_decision_dialogue.json`
- `game/public/assets/levels/level9_subsuelo2_infection_dialogue.json`
- `game/public/assets/levels/level9_descent_pressure.json`
- `game/public/assets/levels/level9_final_sacrifice.json`
- `game/public/assets/levels/level9_narrative_chain.json`

### JSON de soporte fuera de `assets/levels`
- `game/config/levels/level9/level9_exit_routes.json`
- `game/config/levels/level9/level9_flank_combat_zones.json`
- `game/config/levels/level9/level9_escape_failure_and_descent.json`

---

## 9) Archivos TypeScript implicados
### Sistemas directamente ligados a Nivel 9
- `game/src/systems/Level9ObjectiveChain.ts`
- `game/src/systems/ExitEvaluationSystem.ts`
- `game/src/systems/MultiExitRouteSystem.ts`
- `game/src/systems/ExitACinematicSystem.ts`
- `game/src/systems/IrreversibleLossEventSystem.ts`
- `game/src/systems/ExitECinematicDecisionSystem.ts`
- `game/src/systems/Level9DescentPressureSystem.ts`
- `game/src/systems/Subsuelo2InfectionCinematicSystem.ts`
- `game/src/systems/PostCinematicCombatTransitionSystem.ts`
- `game/src/systems/FinalSacrificeSystem.ts`
- `game/src/systems/Level9NarrativeSystem.ts`

### Integraciones/ejemplos útiles para mantenimiento
- `game/src/examples/level9ObjectiveChainExample.ts`
- `game/src/examples/level9NarrativeSystemExample.ts`
- `game/src/examples/exitEvaluationSystemExample.ts`

> Nota: los `examples` documentan cableado de referencia entre sistemas; confirmar la escena runtime real antes de asumir que ese wiring está activo en producción.

---

## 10) Cómo extender el nivel sin romper la narrativa
1. **Extender primero por datos, después por código**
   - Agregar o reordenar beats/objetivos en JSON antes de tocar lógica TS.
   - Mantener IDs estables (`cinematicId`, `eventId`, `targetId`, `destination`) porque los sistemas encadenan avance por igualdad exacta.

2. **No romper contratos de eventos entre sistemas**
   - El objective chain avanza por eventos de dominio concretos (`exit-attempted`, `exit-evaluated`, `permanent-loss-applied`, `group-escaped`).
   - Cambiar nombres de salida (A/B/C/D/E), IDs de cinemática o IDs de pérdida exige actualización transversal en JSON y emisores TS.

3. **Respetar la causalidad narrativa actual**
   - A debe seguir funcionando como falsa salida de apertura.
   - B conserva el rol de pérdida irreversible.
   - E dispara cambio de plan y descenso, no escape directo.
   - El sacrificio final debe seguir siendo condición del escape del resto.

4. **Aislar variaciones por grupo sin duplicar lógica**
   - Para diálogos alternativos, usar estructuras por variante (ej. `dialogueByGroup`) en lugar de forkar sistemas completos.

5. **Validación mínima después de cambios**
   - Verificar que cada `targetId` del objective chain tenga un emisor real en sistemas/integración.
   - Verificar consistencia entre `requiresEvaluated`, orden de salidas y callbacks de evaluación.
   - Verificar que `finalSegmentId` exista en segmentos de presión.
   - Verificar que toda transición final (`escapeTransition.destination`) coincida con el evento esperado por cadena de objetivos.

Con estas reglas, se puede ampliar contenido (nuevos diálogos, encuentros o microeventos de descenso) sin quebrar el arco narrativo implementado.
