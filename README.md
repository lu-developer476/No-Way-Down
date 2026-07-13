# No Way Down

![Phaser](https://img.shields.io/badge/Phaser-3.90-2f2f8f?logo=phaser)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4-646cff?logo=vite&logoColor=white)
![Django](https://img.shields.io/badge/Django-5.1-092e20?logo=django&logoColor=white)
![Django REST Framework](https://img.shields.io/badge/DRF-3.15-a30000)
![Python](https://img.shields.io/badge/Python-3.11+-3776ab?logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL/Supabase-ready-4169e1?logo=postgresql&logoColor=white)

**No Way Down** es un juego 2D cooperativo web, de supervivencia narrativa y estética retro pixel art, ambientado en la Casa Central del Banco de la Nación Argentina. El proyecto ya superó la etapa de scaffold inicial: cuenta con un frontend jugable en Phaser, una campaña JSON-driven con niveles, cinemáticas y sistemas de misión, más un backend Django REST para persistir el progreso del jugador.

## Estado actual del proyecto

- **Frontend jugable en `/game`**: aplicación Phaser 3 + TypeScript + Vite con escenas de arranque, precarga, menú principal, intro de campaña, niveles, cinemáticas, diálogo, piso superior y UI.
- **Campaña principal integrada**: el flujo `main_campaign` encadena introducción, niveles del subsuelo, planta baja, pisos superiores, rescate en oficina 422, descenso, garage, cinemática exterior y epílogo final.
- **Contenido y sistemas de gameplay**: existen configuraciones de niveles, rutas, oleadas, combate, objetivos, eventos narrativos, iluminación, audio, assets institucionales y scripts de generación/auditoría de assets.
- **Backend funcional en `/backend`**: API Django + Django REST Framework con health check y endpoints de guardado/carga de progreso por `user_id`.
- **Persistencia preparada para local y producción**: SQLite en desarrollo y configuración PostgreSQL/Supabase para despliegue en Render.
- **Documentación complementaria en `/docs`**: diseños de niveles, layouts ASCII, plan de assets, multijugador local, mantenimiento y notas de arquitectura.

> Nota: el frontend está orientado a desktop/laptop. La app bloquea pantallas táctiles, orientación vertical o resoluciones menores a 960×540.

## Stack tecnológico

| Capa | Tecnologías |
| --- | --- |
| Juego web | Phaser 3, TypeScript, Vite, Arcade Physics |
| Assets y contenido | JSON, SVG, scripts Node.js para generación y auditoría |
| Backend/API | Python 3.11+, Django 5.1, Django REST Framework |
| Persistencia | SQLite local, PostgreSQL/Supabase en producción |
| Deploy previsto | Render + Supabase |

## Estructura del repositorio

```text
.
├── game/       # Frontend jugable Phaser + TypeScript + Vite
├── backend/    # API Django REST para progreso y health checks
├── docs/       # Documentación técnica, narrativa y de niveles
└── public/     # Referencias visuales estáticas del entorno
```

## Requisitos

- Node.js 20+
- npm
- Python 3.11+
- pip

## Frontend (`/game`)

### Instalar dependencias

```bash
cd game
npm install
```

### Variables de entorno del frontend

Desde la raíz del repositorio:

```bash
cp game/.env.example game/.env
```

Variables importantes:

- `VITE_BACKEND_URL`: URL base del backend. Ejemplo: `http://127.0.0.1:8000`.
- `VITE_PLAYER_ID`: identificador del jugador usado para guardar/cargar progreso.

### Ejecutar en desarrollo

```bash
cd game
npm run dev
```

Por defecto, Vite sirve el juego en `http://localhost:5173`.

### Build de producción

```bash
cd game
npm run build
```

El build ejecuta `tsc --noEmit`, genera el bundle con Vite y valida el flujo de campaña con `scripts/verifyBuildCampaignFlow.mjs`.

### Scripts útiles

```bash
cd game
npm run audit:asset-routes
npm run fix:asset-routes
npm run generate:institutional-tileset
```

También hay scripts para generar spritesheets de mostradores, mesas, columnas, ventanas, decoración, escaleras y daño zombie.

## Backend (`/backend`)

### Crear entorno virtual e instalar dependencias

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Variables de entorno

Desde la raíz del repositorio:

```bash
cp backend/.env.example backend/.env
```

Variables principales:

- `DJANGO_ENV`: `development` o `production`.
- `DJANGO_SECRET_KEY`: clave secreta de Django.
- `DJANGO_DEBUG`: `True` en local, `False` en producción.
- `DJANGO_ALLOWED_HOSTS`: hosts permitidos separados por coma.
- `GAME_ORIGINS`: orígenes CORS permitidos para el frontend.
- `POSTGRES_*`: configuración de PostgreSQL/Supabase para producción.

### Aplicar migraciones y ejecutar servidor

```bash
cd backend
python manage.py migrate
python manage.py runserver
```

### Ejecutar tests backend

```bash
cd backend
python manage.py test
```

## Endpoints backend

- `GET http://127.0.0.1:8000/api/health/`: health check del servicio.
- `POST http://127.0.0.1:8000/api/progress/`: crea o actualiza el progreso de un jugador por `user_id`.
- `GET http://127.0.0.1:8000/api/progress/<user_id>/`: obtiene el progreso persistido de un jugador.

El modelo de progreso persiste nivel actual, vida, aliados rescatados, checkpoint, versión de guardado y un snapshot JSON de campaña.

## Flujo recomendado para desarrollo local

1. Levantar el backend en `http://127.0.0.1:8000`.
2. Configurar `game/.env` con `VITE_BACKEND_URL=http://127.0.0.1:8000`.
3. Levantar el frontend con `npm run dev` dentro de `/game`.
4. Abrir `http://localhost:5173` en desktop/laptop.

## Producción

La configuración de producción contempla Render para el backend y Supabase/PostgreSQL como base de datos. Ver `docs/backend-render-supabase.md` para el detalle de variables, despliegue y conexión.

## Documentación destacada

- `docs/technical-overview.md`: panorama técnico del proyecto.
- `docs/local-multiplayer.md`: diseño de multijugador local.
- `docs/maintenance-guide.md`: guía de mantenimiento.
- `docs/narrative_canon_constraints.md`: restricciones narrativas de canon.
- `docs/level*_design.md` y `docs/*_ascii_layout.md`: diseño y layouts de niveles.
