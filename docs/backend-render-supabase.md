# Backend Django + Supabase (Render)

## Variables de entorno requeridas

### Django base
- `DJANGO_ENV` (`development` o `production`)
- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS` (separado por comas)
- `GAME_ORIGINS` (separado por comas)

### PostgreSQL Supabase (producción)
- `POSTGRES_HOST`
- `POSTGRES_PORT` (normalmente `5432`)
- `POSTGRES_DB` (normalmente `postgres`)
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_SSLMODE` (`require`)
- `POSTGRES_CONN_MAX_AGE` (ej. `60`)

## Comandos de deploy en Render

```bash
python manage.py migrate
python manage.py collectstatic --noinput
```

## Endpoints de progreso

### POST `/api/progress/`
Crea o actualiza el estado de un usuario según `user_id`.

Payload JSON:

```json
{
  "user_id": "player-001",
  "current_level": "nivel_2",
  "life": 2,
  "allies_rescued": 1,
  "checkpoint": "cp_comedor_pasillo"
}
```

### GET `/api/progress/<user_id>/`
Devuelve el último estado persistido del usuario.
