# Nivel 4: documentación técnica breve (mantenimiento)

## Estado actual de implementación
- **Recorrido jugable hoy**: el flujo real del juego va de `GameScene` (nivel base) hacia `UpperFloorScene` usando `LevelExitSystem`; en `UpperFloorScene` se puede volver a `GameScene` por escalera. No hay combate ni progresión específica de Nivel 4 conectada en runtime todavía.
- **Diseño de Nivel 4 en datos/sistemas**: existe una base completa en JSON + sistemas TypeScript para escaleras segmentadas, zonas de combate, eventos ambientales, molinetes y spawns mixtos, pero su integración principal está en archivos de ejemplo o preparada como siguiente paso.

---

## 1) Recorrido completo (diseño de Nivel 4)
Referencia principal: `game/public/assets/levels/level4_segundo_piso.json`.

1. **S1 · Sección de escaleras curvas**
   - Entrada en coordenadas bajas (`entry`) y ascenso en zigzag por `path_hint`.
   - Trigger de introducción y trigger de bloqueo/inicio de combate (`TR-S1-LOCK-COMBAT`).
2. **S2 · Rellanos intermedios**
   - Tramo de transición con rellanos (`landings`) y trigger narrativo.
3. **S3 · Acceso al segundo piso**
   - Cuello de botella con molinetes (`turnstiles`) y mesas de seguridad.
   - Trigger para habilitar paso tras progreso y trigger de emboscada.
4. **S4 · Sector principal del segundo piso**
   - Corredor horizontal largo (`main_corridor`) con puntos de combate final.
5. **S5 · Zona final/salida**
   - Entrada al sector final y `exit_to_next_level`.
   - El `exit_point` final exige `all_combat_zones_cleared`.

> Nota de mantenimiento: este recorrido está definido en datos, pero no está ensamblado como escena principal en el código actual.

---

## 2) Secciones del mapa
Las secciones están normalizadas en `sections[]` de `level4_segundo_piso.json`:

- `S1`: escaleras curvas (combate vertical).
- `S2`: rellanos intermedios (respiro + presión).
- `S3`: acceso con molinetes (filtro de progreso).
- `S4`: hall principal horizontal.
- `S5`: extracción/salida.

Cada sección incluye `bounds`, y según el caso `navigation`, `layout_points` y `event_triggers`.

---

## 3) Zonas de combate
Hay **dos fuentes de configuración** de combate Nivel 4:

1. **`level4_segundo_piso.json`**
   - Define `combat_zones` (`CZ1`..`CZ4`) con `area`, condición de limpieza y `waves`.
   - Está alineado con la narrativa del recorrido por secciones `S1`..`S4`.

2. **`level4_combat_zones.json`**
   - Define `zonas` (`zona-1...zona-5`) + `bloqueos` físicos por zona.
   - Es el formato consumido por `Level4CombatSystem`.

Además:
- **`level4_mixed_spawns.json`** agrega oleadas mixtas por zona (`zoneWaves`) y fuentes de spawn ponderadas (`pointsBySource`).
- **`level4_landing_zones.json`** modela rellanos de descanso, combate y checkpoint para escaleras.

---

## 4) Sistemas involucrados (TypeScript)

### En runtime hoy
- `game/src/scenes/GameScene.ts`
  - Inicializa `LevelExitSystem` para transición a `UpperFloorScene`.
  - Mantiene un ejemplo no conectado para `level4_stair_segments`.
- `game/src/scenes/UpperFloorScene.ts`
  - Escena superior jugable actual (fondo/plataforma/escalera de retorno).
- `game/src/systems/LevelExitSystem.ts`
  - Controla cuándo habilitar salida y transición entre escenas.
- `game/src/systems/StaircaseSystem.ts`
  - Maneja interacción de escaleras con hold para cambiar escena.

### Sistemas de Nivel 4 disponibles (no integrados como flujo principal)
- `game/src/systems/Level4CombatSystem.ts`
  - Adaptador de `level4_combat_zones.json` hacia `LevelProgressionSystem`.
- `game/src/systems/MixedSpawnSystem.ts`
  - Spawns ponderados/seguros por distancia del jugador.
- `game/src/systems/LandingZoneSystem.ts`
  - Rellanos `rest/combat/checkpoint` desde JSON.
- `game/src/systems/Level4AmbientEvents.ts`
  - Triggers ambientales de luces/audio/UI no letales.
- `game/src/systems/TurnstileSystem.ts`
  - Lógica de estado/interacción de molinetes con credenciales.
- `game/src/systems/StairSegmentSystem.ts`
  - Escaleras por segmentos y rellanos (`level4_stair_segments.json`).

### Archivos de ejemplo de integración
- `game/src/examples/level4CombatSystemExample.ts`
- `game/src/examples/landingZoneSystemExample.ts`

---

## 5) Archivos JSON usados

### Usados en runtime principal actual
- `game/public/assets/levels/level2_subsuelo.json`
- `game/public/assets/levels/level2_stairs.json`
- `game/public/assets/levels/level2_vertical_spawns.json`
- `game/public/assets/levels/level4_stair_segments.json` (**importado en `GameScene` como ejemplo, no activado en create**)

### Configuración de Nivel 4 lista para integración
- `game/public/assets/levels/level4_segundo_piso.json`
- `game/public/assets/levels/level4_combat_zones.json`
- `game/public/assets/levels/level4_mixed_spawns.json`
- `game/public/assets/levels/level4_landing_zones.json`
- `game/public/assets/levels/turnstiles_level4.json`
- `game/public/assets/levels/level4_ambient_events.example.json`
- `game/public/assets/levels/second_floor_sector.json` (layout detallado adicional del sector S4)

---

## 6) Archivos TypeScript usados

### Escenas
- `game/src/main.ts`
- `game/src/scenes/BootScene.ts`
- `game/src/scenes/GameScene.ts`
- `game/src/scenes/UpperFloorScene.ts`

### Sistemas base (activos en el flujo actual)
- `game/src/systems/LevelExitSystem.ts`
- `game/src/systems/StaircaseSystem.ts`
- `game/src/systems/ZombieSystem.ts`
- `game/src/systems/VerticalSpawnSystem.ts`
- `game/src/systems/ZombieWaveZone.ts`

### Sistemas Nivel 4 listos para integrar
- `game/src/systems/Level4CombatSystem.ts`
- `game/src/systems/MixedSpawnSystem.ts`
- `game/src/systems/LandingZoneSystem.ts`
- `game/src/systems/TurnstileSystem.ts`
- `game/src/systems/Level4AmbientEvents.ts`
- `game/src/systems/StairSegmentSystem.ts`
- `game/src/examples/level4CombatSystemExample.ts`
- `game/src/examples/landingZoneSystemExample.ts`

---

## 7) Cómo extender este nivel más adelante (guía de mantenimiento)

1. **Crear una escena dedicada de Nivel 4**
   - Basar el mapa y flujo en `level4_segundo_piso.json` (secciones `S1..S5`).
   - Definir entrada/salida con `scene.start` desde `GameScene` y siguiente nivel.

2. **Conectar progresión de combate real**
   - Integrar `Level4CombatSystem` con `level4_combat_zones.json`.
   - Publicar progreso en `registry` para UI/objetivos.

3. **Agregar presión dinámica sin romper legibilidad**
   - Activar `MixedSpawnSystem` por zona (`zoneWaves`) como en `level4CombatSystemExample.ts`.
   - Priorizar `minPlayerDistance`/`unsafePlayerDistance` para evitar spawns injustos.

4. **Integrar rellanos/checkpoints**
   - Usar `LandingZoneSystem` + `level4_landing_zones.json`.
   - Reusar callback de guardado de checkpoint existente (`registry` + API de progreso).

5. **Activar molinetes y gating**
   - Usar `TurnstileSystem` con `turnstiles_level4.json`.
   - Sincronizar desbloqueo con `onZoneCompleted` de combate (por IDs de zona).

6. **Ambientación desacoplada**
   - Incorporar `Level4AmbientEvents` con `level4_ambient_events.example.json`.
   - Mantener eventos como feedback visual/sonoro opcional (sin alterar reglas de combate).

7. **Convenciones recomendadas para mantenimiento**
   - Mantener IDs estables entre JSON y callbacks TS (`zona-*`, `TR-*`, `SP-*`).
   - Evitar duplicar “fuente de verdad” de combate: elegir un JSON principal (o documentar sincronización entre ambos formatos).
   - Añadir pruebas de consistencia de datos (IDs referenciados, secciones existentes, spawns válidos) antes de ampliar contenido.
