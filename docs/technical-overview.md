# No Way Down - Documentación técnica mínima

## Estructura
- `game/`: cliente jugable con Phaser 3 + TypeScript + Vite.
- `backend/`: API con Django + Django REST Framework.
- `docs/`: documentación de soporte.

## Contrato API actual
- `GET /api/health/`: estado del backend.
- `POST /api/progress/`: upsert de progreso por `user_id`.
- `GET /api/progress/<user_id>/`: lectura de progreso persistido.

## Persistencia (Etapa 12)
1. Backend Django desacoplado de la lógica de Phaser.
2. Modelo `PlayerProgress` para guardar estado mínimo de partida:
   - `user_id`
   - `current_level`
   - `life`
   - `allies_rescued`
   - `checkpoint`
3. Settings separados por entorno (`development`/`production`).
4. Producción preparada para PostgreSQL de Supabase via variables de entorno.

## Referencias
- `docs/local-multiplayer.md`: decisiones de Etapa 11 para 2 jugadores y plan de escalado a 3/4.
- `docs/backend-render-supabase.md`: guía de despliegue backend en Render + Supabase.
- `docs/narrative_canon_constraints.md`: reglas para mantener canonicidad narrativa al traducir historia a sistemas Phaser 3.
