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

## Actualización de emergencia: test hermético y espejo GitLab por snapshots

### Hechos confirmados

El falso positivo original del auditor de binarios fue corregido. Sin embargo, el caso que valida `HEAD^` en un checkout detached seguía heredando `GITHUB_EVENT_NAME=push` del runner. La selección de la base era correcta, pero la prueba no controlaba su proceso hijo y esperaba incorrectamente un evento local. La suite ahora elimina explícitamente todas las variables de evento y de base antes de aplicar los valores propios de cada escenario; `local`, `push` y `pull_request` se prueban de manera independiente y sin relajar las aserciones.

El workflow anterior enviaba el commit de GitHub directamente a GitLab y, por lo tanto, intentaba importar toda su historia alcanzable. GitLab rechazó esa historia porque contiene commits antiguos con punteros cuyos objetos no están disponibles. El árbol actual de `main` no depende de ese mecanismo: el arte productivo actual se genera durante el build, permanece ignorado y no está versionado.

GitLab recibe ahora commits snapshot lineales construidos sobre su propia punta válida. Cada snapshot exporta exclusivamente el árbol Git actual de GitHub, rechaza punteros activos, comprueba igualdad exacta de tree SHA antes y después del push y registra el SHA fuente en trailers del mensaje. No se recuperan binarios históricos, no se fuerza el push y no se importan tags ni ramas temporales.

### Topología e identidad

```text
GitHub main (historia canónica y source SHA)
  -> snapshot sanitizado del árbol actual
  -> GitLab main (commit de despliegue lineal)
  -> Render
  -> build-info (source SHA y deploy commit separados)
```

`sourceSha`, `frontendSha` y `backendSha` identifican el código fuente de GitHub. `deployCommit` (y, por compatibilidad, `renderCommit`) identifica el commit que el proveedor conectado a Render desplegó, por lo que puede ser el snapshot de GitLab y diferir del source SHA sin representar código diferente. El tree SHA es la prueba de equivalencia del código.

Render **puede** estar conectado a GitLab, pero no debe asumirse sin evidencia. La procedencia se determina con el hostname sanitizado de `remote.origin.url` y se contrasta con las variables de Render, `build-info` y los logs del build. Nunca se registran credenciales ni la URL sin sanitizar.

### Verificación operativa posterior al merge

El workflow exclusivo de pushes a `main` y ejecuciones manuales crea el snapshot, hace un push fast-forward, vuelve a obtener la punta remota y valida tree y trailer. Su artifact textual registra el source SHA/tree y el snapshot SHA/tree. La identidad de build conserva `RENDER_GIT_COMMIT` como commit de despliegue, pero obtiene primero `Source-GitHub-SHA` del trailer para publicar la identidad canónica del código.
