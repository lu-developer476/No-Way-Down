# Nivel 8 — Diseño técnico para mantenimiento (rescate oficina 422)

## 1) Resumen narrativo del nivel
El Nivel 8 está planteado como una misión de **rescate con cambio de prioridad**:

1. arranca en el sector de **Servicios de Comunicaciones**,
2. recorre una parte del trayecto previo hasta escaleras y descenso,
3. entra en la **oficina 422** para ejecutar un rescate crítico,
4. resiste una oleada en espacio semi-cerrado,
5. activa una cinemática de mensaje que cambia la urgencia,
6. restaura checkpoint con **temporizador (5:30)**,
7. completa descenso al piso 1,
8. resuelve combate final y cinemática de salida hacia Nivel 9.

La secuencia está representada por objetivos en `level8_objective_chain.json` y por sistemas TS separados (intro, rescate, oleada, checkpoint temporizado, descenso, asedio final y outro).

---

## 2) Estructura de mapa (vista funcional)
Para mantenimiento conviene leer el nivel por bloques funcionales, no sólo por layout visual:

- **Bloque A — Arranque narrativo y orientación**
  - Cinemática inicial con variantes `solo` / `squad`.
  - Objetivo posterior: ir a oficina 422.

- **Bloque B — Tránsito y recorrido parcial inverso**
  - Inicio en Servicios de Comunicaciones.
  - Decisión de ruta (pasillo u oficinas).
  - Llegada a escaleras y descenso al piso 4.

- **Bloque C — Oficina 422**
  - Trigger de rescate en área concreta.
  - Secuencia narrativa de rescate.
  - Recompensa de arma + incorporación de aliada rescatada.
  - Combate por oleadas dentro/entorno inmediato de oficina.

- **Bloque D — Zona de descanso / ascensores**
  - Trigger de cinemática del mensaje de la hermana.
  - Activación de checkpoint restaurado e inicio de contrarreloj.

- **Bloque E — Descenso contrarreloj 4 → 1**
  - Ruta por secciones (pisos 4, 3, 2 y 1).
  - Encuentros mayormente opcionales en 4/3/2.
  - Encuentro **requerido** al final en piso 1.

- **Bloque F — Cierre de nivel**
  - Asedio final en piso 1 (sistema de olas o grupo compacto según config).
  - Cinemática outro.
  - Habilitación de transición a Nivel 9.

Referencia de layout visual existente: `docs/level8_rescate_oficina_422_ascii_layout.md`.

---

## 3) Recorrido inverso parcial respecto del Nivel 7
El diseño de objetivos de Nivel 8 indica explícitamente un arranque en **Servicios de Comunicaciones** y una progresión hacia escaleras/descenso, lo que funciona como retorno parcial sobre el espacio narrativo previo:

- `start_communications_services` → `section-entered: communications_services`
- `choose_route` → `route-selected: hallway_or_offices`
- `reach_stairs` → `stairs-reached: stairs_floor4_access`
- `descend_to_floor4` → `floor-reached: floor_4`

Esto debe mantenerse coherente con los identificadores de secciones/rutas emitidos por la integración en escena. Si cambian IDs, el `Level8ObjectiveChain` dejará de completar objetivos en orden.

---

## 4) Oficina 422 y rescate
### 4.1 Trigger y secuencia
`level8_office422_rescue.json` define:
- área de trigger del rescate,
- secuencia de pasos narrativos (`rescueScene.sequence`),
- bloqueo de movimiento durante la secuencia,
- compañera objetivo (`ally_survivor_422`),
- recompensa de arma (`smg_compacta`, 90 de munición),
- actualización de composición de grupo y marca de rescatada.

### 4.2 Oleada posterior al rescate
`level8_office422_wave_combat.json` define:
- trigger de combate,
- bloqueo de salida durante combate,
- spawn points por carril (`interior`, `hallway`, `door`),
- modo de espacio reducido (`maxAliveEnemies`),
- dos olas (`office_422_wave_1`, `office_422_wave_2`).

### 4.3 Integración de referencia
`game/src/examples/office422RescueWaveCombatExample.ts` encadena el flujo sugerido:
1) se completa rescate,
2) se otorga arma,
3) inicia oleada automáticamente,
4) al completar, se libera salida.

> Nota de mantenimiento: este archivo es ejemplo de integración. Validar escena runtime real antes de asumir que ya está cableado en producción.

---

## 5) Checkpoint con temporizador
El checkpoint temporizado está parametrizado en `level8_timed_checkpoint.json` y ejecutado por `TimedCheckpointSystem`.

### Comportamiento clave configurado
- ID checkpoint: `p4_rest_ascensores_checkpoint`.
- Duración: `330000 ms` (05:30).
- Restaura un checkpoint concreto del piso 4 (`cp_p4_ascensores`).
- Al activarse:
  - actualiza objetivo de contrarreloj,
  - publica hint de inicio,
  - guarda estado en `registry`.
- Al expirar:
  - comportamiento: `restart_checkpoint`.
  - además define bloque `penalty` (datos disponibles para el flujo de penalización si se utiliza ese modo).

### Relación con descenso
`Level8TimedDescentSystem` consulta snapshot del temporizador para habilitar progresión (secciones/encuentros sólo avanzan con timer en estado `running`) y marca éxito con `completeRace()` al terminar la sección final.

---

## 6) Combate final en piso 1
Hay dos piezas de datos que conviene distinguir:

1. **En la ruta de descenso (`level8_descent_route.json`)**
   - sección final: `floor1_objective`,
   - encounter requerido: `f1_final_hold`,
   - condición `requireRequiredEncountersToComplete: true`.

2. **En asedio final dedicado (`level8_final_siege.json`)**
   - `siegeId`: `level8-floor1-final-siege`,
   - trigger + área de combate,
   - bloqueadores de progresión durante asedio,
   - spawn por olas (3 olas configuradas) y temporizador de urgencia,
   - refuerzo opcional si expira el temporizador de urgencia,
   - soporte alternativo `compactGroup`.

El objective chain utiliza `combat-completed: level8-floor1-final-siege`, por lo que si se modifica `siegeId` debe actualizarse también en la cadena de objetivos.

---

## 7) Archivos JSON implicados
### Flujo principal Nivel 8
- `game/public/assets/levels/level8_objective_chain.json`
- `game/public/assets/levels/level8_intro_dialogue.json`
- `game/public/assets/levels/level8_office422_rescue.json`
- `game/public/assets/levels/level8_office422_wave_combat.json`
- `game/public/assets/levels/level8_sister_message_dialogue.json`
- `level8_timed_checkpoint.json`
- `game/public/assets/levels/level8_descent_route.json`
- `game/public/assets/levels/level8_final_siege.json`
- `game/public/assets/levels/level8_outro_dialogue.json`

### Soporte documental
- `docs/level8_rescate_oficina_422_ascii_layout.md`

---

## 8) Archivos TypeScript implicados
### Sistemas de nivel 8
- `game/src/systems/Level8ObjectiveChain.ts`
- `game/src/systems/Level8IntroCinematicSystem.ts`
- `game/src/systems/Office422RescueSystem.ts`
- `game/src/systems/Office422WaveCombatSystem.ts`
- `game/src/systems/RescuedAllyIntegrationSystem.ts`
- `game/src/systems/Level8TimedDescentSystem.ts`
- `game/src/systems/Level8FinalSiegeSystem.ts`
- `game/src/systems/Level8OutroCinematicSystem.ts`

### Sistema compartido clave
- `game/src/systems/TimedCheckpointSystem.ts`

### Integración de referencia
- `game/src/examples/office422RescueWaveCombatExample.ts`

---

## 9) Cómo extender el nivel sin romper su flujo narrativo
1. **Extender primero por datos (JSON), luego por código**
   - Agregar encuentros/rutas en JSON antes de tocar lógica TS.
   - Mantener IDs estables en cadena de objetivos.

2. **No romper contratos entre sistemas**
   - `objective_chain` depende de eventos con `targetId` exacto.
   - Cambiar `checkpoint.id`, `siegeId`, `rescueId` o `cinematicId` exige ajuste transversal.

3. **Mantener separación de responsabilidades**
   - Intro/outro: sólo narrativa y objetivos.
   - Rescue/oleada/siege: combate y pacing táctico.
   - Timed checkpoint + descent: presión temporal y progresión vertical.

4. **Si se agregan nuevos beats narrativos**
   - Insertarlos en `level8_objective_chain.json` respetando orden causal.
   - Evitar objetivos que dependan de eventos no emitidos por sistemas existentes.

5. **Validación mínima recomendada tras cambios**
   - Verificar que cada `targetId` de objetivos tenga emisor real.
   - Verificar que IDs de spawn points usados por waves existan en el mismo JSON.
   - Verificar que `finalSectionId` exista en `sections` de `level8_descent_route.json`.

6. **Precaución de integración**
   - Este repositorio incluye sistemas y ejemplo de integración para partes del flujo.
   - Antes de ampliar contenido, confirmar qué escena runtime invoca cada sistema para no documentar como “activo” algo que sigue en modo ejemplo.
