# Incidente: despliegues obsoletos entre GitHub CI y Render

## Alcance

Este documento separa los hechos confirmados, la información reportada y los puntos que todavía deben comprobarse mediante identidades de commit. No atribuye una causa no verificada al estado de producción.

## CONFIRMADO

- GitHub Actions falla en el paso `audit:no-binary-diff` del workflow `Production deploy gate`.
- La causa del fallo es la regla amplia `generate|render|export ... png|audio`, que interpreta palabras legítimas como si fueran operaciones de generación binaria.
- `game/src/config/LowerBasementLightingProfiles.ts` produce el falso positivo al combinar código de exportación y perfiles con `audioLoops`; ese código no escribe binarios.
- Al fallar ese gate, build, tests, las auditorías posteriores y el E2E quedan `skipped`.
- `render.yaml` no fijaba explícitamente `branch` ni `autoDeployTrigger`.
- El backend ya expone `/api/build-info/`.

## REPORTADO POR EL USUARIO

- GitHub muestra errores desde el rango del PR #402.
- Render reflejó cambios hasta el PR #423.
- Los cambios posteriores no se ven en producción.

Estos puntos describen el reporte del usuario y no sustituyen la verificación por SHA.

## A VERIFICAR MEDIANTE SHA

- El commit exacto que está sirviendo Render.
- La configuración anterior efectiva de auto deploy en Render.
- Un posible cache obsoleto de `index.html`.
- El último deploy exitoso real.

La verificación debe comparar `/api/build-info/`, `/build-info.json`, el header del documento SPA y `window.__NWD_BUILD__` contra el SHA esperado del deploy.
