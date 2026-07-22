# Backend Django + PostgreSQL (Supabase) en Render

Esta guía describe el despliegue full-stack actual: **un único Render Web Service Python** ejecuta Django/Gunicorn, compila el juego Vite durante el build y sirve el frontend compilado con WhiteNoise desde el mismo dominio.

## 1) Rutas esperadas

- `GET /`: devuelve `index.html` del juego compilado en `game/dist`.
- `GET /assets/...`, favicons y JSON públicos: servidos por WhiteNoise desde `game/dist` conservando las URLs generadas por Vite.
- `GET /api/health/`: health check JSON del backend.
- `POST /api/progress/`: crea/actualiza progreso por `user_id`.
- `GET /api/progress/<user_id>/`: obtiene progreso persistido.
- `GET /admin/`: Django Admin.
- Rutas frontend desconocidas: devuelven `index.html` para soportar navegación SPA.
- Rutas `/api/` inexistentes: devuelven error API; no deben caer al `index.html`.

## 2) Variables de entorno requeridas en Render

### Runtime
- `PYTHON_VERSION=3.11.9`
- `NODE_VERSION=20.18.1`

### Django
- `DJANGO_ENV=production`
- `DJANGO_SECRET_KEY=<valor-seguro>`
- `DJANGO_DEBUG=False`
- `DJANGO_ALLOWED_HOSTS=<tu-servicio.onrender.com>` (múltiples hosts separados por coma)
- `GAME_ORIGINS=<orígenes locales o de frontend permitidos>` (múltiples orígenes separados por coma)
- `DJANGO_LOG_LEVEL=INFO` (recomendado)
- `DJANGO_SECURE_SSL_REDIRECT=True` (recomendado si el proxy está configurado para HTTPS)
- `DJANGO_SECURE_HSTS_SECONDS=3600` (o mayor, según política)

### Frontend
- En producción, `VITE_BACKEND_URL` debe quedar vacío o no definirse para usar rutas relativas del mismo dominio (`/api/...`).
- En desarrollo local, usar `VITE_BACKEND_URL=http://127.0.0.1:8000` en `game/.env`.

### PostgreSQL (Supabase)
- `POSTGRES_HOST=<host de Supabase>`
- `POSTGRES_PORT=5432`
- `POSTGRES_DB=postgres`
- `POSTGRES_USER=<usuario>`
- `POSTGRES_PASSWORD=<password>`
- `POSTGRES_SSLMODE=require`
- `POSTGRES_CONN_MAX_AGE=60`

> Si falta alguna variable de PostgreSQL o es inválida, es común obtener `500/503` en endpoints que tocan DB (`/api/progress/*`).

## 3) Build / Start commands en Render

Build Command:

```bash
./scripts/render-build.sh
```

Start Command:

```bash
cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

El script de build ejecuta `pip`, `npm ci --prefix game`, `npm run build --prefix game`, verifica `game/dist/index.html` y luego corre `python backend/manage.py collectstatic --noinput`.

## 4) Migraciones (obligatorio)

Después del deploy inicial o cuando cambie el esquema, correr:

```bash
cd backend && python manage.py migrate
```

Si las migraciones no están aplicadas, `/api/progress/` y `/api/progress/<user_id>/` pueden fallar por tabla inexistente.

## 5) Checklist posterior al deploy

1. Confirmar que Render usa `./scripts/render-build.sh`.
2. Confirmar que Render usa `cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`.
3. Confirmar `PYTHON_VERSION=3.11.9` y `NODE_VERSION=20.18.1`.
4. Ejecutar migraciones si corresponde.
5. Verificar:
   - `GET /` -> `200` HTML del juego.
   - `GET /assets/<archivo-generado>` -> `200`.
   - `GET /api/health/` -> `200` JSON.
   - `POST /api/progress/` con payload válido -> `201` o `200`.
   - `GET /api/progress/<user_id>/` -> `200`.
   - `GET /api/no-existe/` -> error API, no HTML.
