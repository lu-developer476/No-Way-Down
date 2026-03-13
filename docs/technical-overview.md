# No Way Down - Documentación técnica mínima (Etapa 1)

## Estructura
- `game/`: cliente jugable con Phaser 3 + TypeScript + Vite.
- `backend/`: API con Django + Django REST Framework.
- `docs/`: documentación de soporte.

## Contrato inicial de API
- `GET /api/health/`: estado del backend.
- `POST /api/sessions/`: crea una sesión placeholder preparada para 4 jugadores + aliados IA.

## Criterios de diseño para escalar
1. Cliente desacoplado por escenas (Boot + Cafeteria).
2. Backend con endpoints pequeños y orientados a sesión/lobby.
3. Integración de Supabase configurada por variables de entorno para autenticación futura.
