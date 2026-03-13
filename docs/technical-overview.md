# No Way Down - Documentación técnica mínima

## Estructura
- `game/`: cliente jugable con Phaser 3 + TypeScript + Vite.
- `backend/`: API con Django + Django REST Framework.
- `docs/`: documentación de soporte.

## Contrato inicial de API
- `GET /api/health/`: estado del backend.
- `POST /api/sessions/`: crea una sesión placeholder preparada para 4 jugadores + aliados IA.

## Criterios de diseño para escalar
1. Cliente desacoplado por escenas (Boot + Gameplay).
2. Backend con endpoints pequeños y orientados a sesión/lobby.
3. Integración de Supabase configurada por variables de entorno para autenticación futura.
4. Multijugador local humano desacoplado por configuración (`game/src/config/localMultiplayer.ts`).

## Referencias
- `docs/local-multiplayer.md`: decisiones de Etapa 11 para 2 jugadores y plan de escalado a 3/4.
