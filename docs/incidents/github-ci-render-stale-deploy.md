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

## Actualización posterior al PR #431: build del snapshot y carrera del smoke

El PR #431 reparó el mirror: GitLab recibió correctamente el snapshot `d6062a04f5a40133730a8cc0fb25ae64f00b6a53`, cuyo trailer `Source-GitHub-SHA` identifica el source de GitHub `91b0a2fde4cb09302aa5de316c24d349af03af52`. El problema posterior no era el transporte a GitLab ni la estrategia de snapshots.

GitHub CI invocaba `npx tsc --noEmit -p game/tsconfig.json` desde la raíz, donde no hay un package de TypeScript. `npx` resolvió y descargó el paquete ajeno `tsc@2.0.4`, que respondió “This is not the tsc command you are looking for”. El typecheck canónico es ahora `npm run typecheck --prefix game`, que resuelve TypeScript 5 desde `game/node_modules/.bin/tsc` sin instalar paquetes durante el check.

Render, por su parte, ejecutaba una auditoría de diferencias basada en `HEAD^`. El primer snapshot sanitizado puede ser un root commit sin padre; la base cayó al árbol vacío `4b825dc642cb6eb9a060e54bf8d69288fbee4904` y convirtió los 6123 paths del árbol en supuestas altas. Además, `.venv` no estaba ignorado y el auditor intentó leer un directorio como archivo, causando `EISDIR`.

La solución separa responsabilidades. GitHub conserva `audit:no-binary-diff` para cambios de PRs y pushes a `main`; esa auditoría clasifica ahora archivos, directorios, symlinks, gitlinks y ausencias antes de leer. Render ejecuta antes de instalar dependencias `audit:deploy-source-tree`, que recorre únicamente `git ls-files -z`, valida trailers y tree, rechaza LFS, gitlinks, symlinks, entornos rastreados y PNG generados, y conserva las verificaciones específicas de assets protegidos y los 35 nodos del manifiesto. `.venv/`, `venv/`, `env/` y `.python-version.local` están ignorados y los entornos no rastreados nunca forman parte de la auditoría del árbol.

El orden de Render es: resolver e imprimir identidad; auditar el árbol rastreado; instalar Python y Node; ejecutar las auditorías de contenido; ejecutar el typecheck local; limpiar y construir `dist`; verificar index, build-info, identidad y arte de distribución; y ejecutar `collectstatic`.

El E2E productivo también estaba ubicado en el gate anterior al deploy y podía comparar producción con un SHA que Render todavía no había publicado. El gate previo conserva auditorías, tests, typecheck, build, verificaciones de `dist` y tests backend, pero no consulta producción. El smoke posterior escucha la finalización exitosa de `Mirror main snapshot to GitLab` para `main`, hace checkout de `workflow_run.head_sha`, espera que `/api/build-info/` publique ese source SHA tanto en backend como frontend y recién entonces inicia el browser.

### Identidades que no deben confundirse

- **Source SHA de GitHub:** commit canónico de código, por ejemplo `91b0a2fde4cb09302aa5de316c24d349af03af52`.
- **Snapshot SHA de GitLab:** commit sanitizado que lleva los trailers; en el incidente fue `d6062a04f5a40133730a8cc0fb25ae64f00b6a53`.
- **Commit desplegado:** identidad del commit recibido por el proveedor de Render; para este despliegue coincide con el snapshot anterior.
- **Tree SHA:** identidad del árbol, que debe coincidir entre source GitHub y snapshot aunque sus commits difieran.
- **SHA visible en producción:** `sourceSha`/`frontendSha` servido por build-info; debe ser el source SHA de GitHub, mientras `deployCommit` conserva el snapshot desplegado.
