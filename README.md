# No Way Down

Scaffold inicial del proyecto para un juego 2D cooperativo web ambientado en el comedor del piso -1 de la Casa Central del Banco de la Nación Argentina.

## Estructura del repositorio

- `game/` → Frontend jugable (Phaser 3 + TypeScript + Vite)
- `backend/` → API (Django + Django REST Framework)
- `docs/` → Documentación técnica mínima

## Requisitos

- Node.js 20+
- Python 3.11+
- pip

## Frontend (`/game`)

### Instalar dependencias

```bash
cd game
npm install
```

### Ejecutar en desarrollo

```bash
npm run dev
```

### Build de producción

```bash
npm run build
```

## Backend (`/backend`)

### Crear entorno virtual e instalar dependencias

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Variables de entorno

```bash
cp .env.example .env
```

### Aplicar migraciones y ejecutar servidor

```bash
python manage.py migrate
python manage.py runserver
```

### Ejecutar tests backend

```bash
python manage.py test
```

## Endpoints backend (Etapa 12)

- `GET http://127.0.0.1:8000/api/health/`
- `POST http://127.0.0.1:8000/api/progress/` (crea/actualiza progreso por `user_id`)
- `GET http://127.0.0.1:8000/api/progress/<user_id>/` (obtiene progreso de un jugador)

## Variables para producción (Render + Supabase)

Ver `docs/backend-render-supabase.md` para el detalle completo.
