# Backend Django + PostgreSQL (Supabase) en Render

Esta guía deja el backend Django listo para deploy en Render usando PostgreSQL de Supabase, sin cambiar el stack.

## 1) Estado esperado de endpoints

- `GET /`:
  - Ahora responde `200` con un JSON simple de health (`status`, `service`, `timestamp`).
  - Esto evita el `404` raíz en producción y simplifica monitoreo básico.
- `GET /api/health/`: health explícito de API.
- `POST /api/progress/`: crea/actualiza progreso por `user_id`.
- `GET /api/progress/<user_id>/`: obtiene progreso persistido.

## 2) Variables de entorno requeridas en Render

### Django
- `DJANGO_ENV=production`
- `DJANGO_SECRET_KEY=<valor-seguro>`
- `DJANGO_DEBUG=False`
- `DJANGO_ALLOWED_HOSTS=<tu-servicio.onrender.com>` (múltiples hosts separados por coma)
- `GAME_ORIGINS=<https://tu-frontend.onrender.com>` (múltiples orígenes separados por coma)
- `DJANGO_LOG_LEVEL=INFO` (recomendado)
- `DJANGO_SECURE_SSL_REDIRECT=True` (recomendado)
- `DJANGO_SECURE_HSTS_SECONDS=3600` (o mayor, según política)

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

Configurar el servicio web (Python) con:

### Build Command
```bash
pip install -r backend/requirements.txt
python backend/manage.py collectstatic --noinput
```

### Start Command
```bash
cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

## 4) Migraciones (obligatorio)

Después de deploy (o al crear el servicio), correr:

```bash
cd backend && python manage.py migrate
```

Migración mínima esperada del proyecto actual:
- `api.0001_initial`

Si esta migración no está aplicada, `/api/progress/` y `/api/progress/<user_id>/` pueden fallar por tabla inexistente (`relation does not exist`), derivando en error server-side.

## 5) collectstatic

- Sí aplica en este proyecto (Django `staticfiles` está habilitado).
- Debe correrse en build (`collectstatic --noinput`).

## 6) Checklist exacto para Render

1. Crear Web Service apuntando al repo.
2. Definir root del proyecto en Render (o usar comandos con `cd backend`).
3. Cargar variables de entorno listadas arriba.
4. Configurar Build Command y Start Command exactamente como se indica.
5. Desplegar.
6. Ejecutar migraciones (`cd backend && python manage.py migrate`) desde Shell de Render.
7. Verificar:
   - `GET /` -> `200` con JSON health
   - `GET /api/health/` -> `200`
   - `POST /api/progress/` con payload válido -> `201` (nuevo) o `200` (update)
   - `GET /api/progress/<user_id>/` -> `200`

## 7) Causa más probable del `500` observado

La causa más probable en producción es **base de datos no lista para el esquema esperado**:
- migraciones no corridas, o
- variables `POSTGRES_*` incompletas/incorrectas, o
- SSL mode no configurado (`POSTGRES_SSLMODE=require`) para Supabase.

Como endurecimiento adicional, `POST /api/progress/` ahora controla explícitamente errores de validación de DRF e integridad de DB para devolver respuestas controladas (`400/409/503`) en lugar de error genérico.
