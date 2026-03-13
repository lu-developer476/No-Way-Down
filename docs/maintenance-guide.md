# No Way Down - Guía técnica mínima de mantenimiento

## 1) Arquitectura general del proyecto

El repositorio está dividido en dos aplicaciones desacopladas:

- **Frontend (`game/`)**: juego 2D en **Phaser 3 + TypeScript + Vite**.
  - Inicializa Phaser en `main.ts` y registra escenas (`BootScene`, `GameScene`, `UpperFloorScene`, `UIScene`).
  - Consume backend vía `fetch` en `progressApi.ts`.
- **Backend (`backend/`)**: API REST en **Django + DRF**.
  - Expone endpoints de salud y persistencia de progreso (`/api/health`, `/api/progress`).
  - Persiste progreso en el modelo `PlayerProgress`.

No hay lógica de gameplay en Django: el backend sólo guarda/carga estado de progreso.

---

## 2) Flujo actual del juego

1. **Arranque**:
   - `BootScene` genera texturas placeholder y hace `start('GameScene')`.
2. **Nivel principal (`GameScene`)**:
   - Crea mapa del comedor, plataformas y jugadores activos (según `ACTIVE_LOCAL_PLAYER_COUNT`).
   - Spawnea zombies en posiciones fijas.
   - Spawnea aliados iniciales ligados al jugador líder.
   - Objetivo activo: eliminar todos los zombies del comedor.
3. **Progresión de misión**:
   - `MissionSystem` marca objetivo como completado cuando `zombiesRemaining === 0`.
   - Al completar, se desbloquea escalera `dining-to-upper`.
4. **Transición de piso**:
   - Jugador mantiene `E` sobre la escalera (`StaircaseSystem`) para ir a `UpperFloorScene`.
5. **Piso superior (`UpperFloorScene`)**:
   - Escena de exploración simple con escalera de regreso (`upper-to-dining`, desbloqueada desde inicio).
6. **Persistencia manual (API)**:
   - `P`: guarda progreso (`POST /api/progress/`).
   - `O`: carga progreso (`GET /api/progress/<user_id>/`) y reinicia/cambia escena según `current_level`.
7. **Derrota**:
   - Si un jugador muere en `GameScene`, se pausa física y se reinicia escena tras delay.

---

## 3) Estructura de carpetas

```text
backend/
  api/
    models.py        # PlayerProgress
    serializers.py   # Serializer de progreso
    views.py         # Health + upsert/detail de progreso
    urls.py          # Rutas /api/...
  config/
    settings/        # base, development, production
    urls.py          # include('api.urls')
  manage.py

game/
  src/
    scenes/          # BootScene, GameScene, UpperFloorScene, UIScene
    entities/        # Player, Zombie, AllyAI, Projectile
    systems/         # Zombie, Ally, Mission, Staircase, Projectile
    services/        # progressApi (fetch al backend)
    config/          # localMultiplayer
    main.ts          # config principal Phaser

docs/
  *.md              # documentación técnica
```

---

## 4) Entidades principales

### Frontend
- **Player** (`entities/Player.ts`)
  - Movimiento, salto, disparo, vida, daño e invulnerabilidad temporal.
- **Zombie** (`entities/Zombie.ts`)
  - IA simple horizontal hacia el objetivo dentro de rango.
  - Vida y muerte por daño.
- **AllyAI** (`entities/AllyAI.ts`)
  - Sigue al jugador y daña zombies cercanos en cooldown.
- **Projectile** (`entities/Projectile.ts`)
  - Bala reutilizable por pool; se desactiva por colisión o fuera de bounds.

### Sistemas de gameplay
- **ProjectileSystem**: pool y cadencia de disparos.
- **ZombieSystem**: spawn, colliders, overlap con proyectiles, update de zombies.
- **AllySystem**: spawn/update de aliados y colisiones con entorno.
- **MissionSystem**: objetivos secuenciales con estado `pending/active/completed`.
- **StaircaseSystem**: zonas de escalera, desbloqueo y transición por mantener `E`.

### Backend
- **PlayerProgress** (`backend/api/models.py`)
  - Campos persistidos: `user_id`, `current_level`, `life`, `allies_rescued`, `checkpoint`, timestamps.

---

## 5) Cómo ejecutar frontend y backend

## Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

## Frontend
```bash
cd game
npm install
cp .env.example .env
npm run dev
```

Variables mínimas frontend:
- `VITE_BACKEND_URL` (ej: `http://127.0.0.1:8000`)
- `VITE_PLAYER_ID`

---

## 6) Cómo agregar un nuevo enemigo (estado real del código)

Hoy existe un único sistema de enemigos (`Zombie`). La forma más segura de extender sin romper lo actual es:

1. **Crear nueva entidad** en `game/src/entities/` (ej. `Mutant.ts`) con API compatible mínima:
   - `update(targetX: number)`
   - `takeDamage(amount: number)`
   - muerte desactivando body (`disableBody(true, true)`).
2. **Crear sistema dedicado** en `game/src/systems/` (ej. `MutantSystem.ts`) replicando patrón de `ZombieSystem`:
   - grupo arcade
   - `spawn(...)`
   - `createColliders(...)`
   - `createProjectileOverlap(...)`
   - `update(...)`
3. **Integrar en escena** (`GameScene` o nueva escena):
   - instanciar sistema
   - spawnear
   - registrar colisiones/overlaps con jugadores/proyectiles
   - incluir su conteo en objetivo/misiones sólo si corresponde

> Nota: actualmente `MissionSystem` usa `zombiesRemaining`; si el nuevo enemigo debe contar para completar misión, hay que extender el contexto de misión y la condición de objetivo.

---

## 7) Cómo agregar un nuevo piso o nivel

La estructura actual ya soporta más escenas con escalera. Pasos:

1. **Crear escena nueva** en `game/src/scenes/` (ej. `Basement2Scene.ts`) extendiendo `Phaser.Scene`.
2. **Registrar la escena** en el arreglo `scene` de `game/src/main.ts`.
3. **Definir punto de entrada/salida** con `StaircaseSystem`:
   - en escena origen: `registerStair({... target: { sceneKey: 'NuevaEscena', spawnPoint } })`
   - en escena destino: escalera de retorno u otra conexión.
4. **Persistencia**:
   - asegurarse de que `current_level` sea el `scene.key` nuevo para que `loadProgressFromApi()` pueda `scene.start(progress.current_level, ...)`.
5. **Objetivos/UI (opcional)**:
   - actualizar `registry` (`currentObjective`, contadores) si la nueva escena usa HUD.

Con esto, el nivel queda navegable y compatible con guardado/carga ya implementados.
