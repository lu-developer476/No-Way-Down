# Mirror automático de GitHub a GitLab

Este repositorio incluye un workflow de GitHub Actions que replica automáticamente las referencias de GitHub hacia el repositorio existente de GitLab. El mirror conserva el nombre original de cada branch y tag: no envía todos los cambios a un branch fijo.

## Qué replica

El workflow está en `.github/workflows/mirror-to-gitlab.yml` y se ejecuta en estos casos:

- `push` a cualquier branch, incluyendo branches usados por Pull Requests.
- `push` de cualquier tag.
- Ejecución manual desde la pestaña **Actions** mediante `workflow_dispatch`.

Esto significa que los commits realizados en branches de Pull Requests también aparecen en GitLab con el mismo nombre de branch. Cuando un Pull Request se mergea en GitHub, el push resultante a `main` también replica `main` en GitLab.

## Cómo funciona

La acción usa `actions/checkout@v4` con historial completo (`fetch-depth: 0`) y sin descargar Git LFS (`lfs: false`). Después agrega el remoto de GitLab usando únicamente la URL del repositorio:

```bash
git remote add gitlab "${GITLAB_MIRROR_URL}"
```

Las credenciales no se colocan dentro de la URL del remoto. La autenticación se envía a GitLab con `http.extraheader` y Basic Authentication para `git ls-remote`, `git fetch` y `git push`, sin imprimir el token ni el header.

Para branches, el workflow usa `GITHUB_REF_NAME`, conserva exactamente el mismo nombre en GitLab, soporta nombres con slash, trae primero el estado remoto y luego empuja con `--force-with-lease`:

```bash
git fetch gitlab \
  "+refs/heads/${branch}:refs/remotes/gitlab/${branch}" || true

git push gitlab \
  "HEAD:refs/heads/${branch}" \
  --force-with-lease
```

Para tags, replica exactamente el mismo tag hacia `refs/tags/<tag>` en GitLab.

## Secretos requeridos en GitHub

Configurar en **GitHub → Settings → Secrets and variables → Actions → Repository secrets**:

| Secreto | Requerido | Descripción |
| --- | --- | --- |
| `GITLAB_MIRROR_URL` | Sí | URL HTTPS exacta del repositorio GitLab existente, terminada en `.git` y sin credenciales. Copiarla desde **GitLab → Code → Clone with HTTPS**. Ejemplo: `https://gitlab.com/grupo/no-way-down.git`. |
| `GITLAB_MIRROR_TOKEN` | Sí | Personal Access Token o Project Access Token de GitLab con permiso `write_repository` sobre el repositorio destino. |
| `GITLAB_MIRROR_USERNAME` | No | Usuario asociado al token. Si se omite o queda vacío, el workflow usa `lu-developer476`. |

No configurar ningún secret para forzar un branch destino: el mirror ya no usa un branch fijo y siempre conserva el branch de origen.

## Configuración recomendada en GitLab y Render

1. Usar el repositorio GitLab de No Way Down que Render ya tiene conectado.
2. No hardcodear ni cambiar el path de GitLab en el workflow. La URL debe copiarse desde **GitLab → Code → Clone with HTTPS** y cargarse completa en `GITLAB_MIRROR_URL`.
3. Crear en GitLab un token con permiso `write_repository` para ese repositorio.
4. Cargar los secretos requeridos en GitHub.
5. Verificar que Render esté conectado al branch esperado en GitLab, normalmente `main`.
6. Ejecutar manualmente el workflow **Mirror to GitLab** una primera vez para validar el acceso.
7. Confirmar que GitLab recibió el branch o tag y que Render inició el deploy cuando corresponda.
8. A partir de ahí, trabajar con Pull Requests en GitHub normalmente; los pushes a los branches del PR se replican y el merge final replica `main`.

## Ejecución manual

Para ejecutar el mirror manualmente:

1. Ir a **GitHub → Actions**.
2. Seleccionar el workflow **Mirror to GitLab**.
3. Presionar **Run workflow**.
4. Elegir el branch desde el que se quiere ejecutar.
5. Confirmar la ejecución y revisar los logs.

## Si GitLab rechaza el push

Si GitLab rechaza el push, revisar:

- Que `GITLAB_MIRROR_URL` sea HTTPS, termine en `.git` y sea exactamente la URL de **Clone with HTTPS** del repositorio GitLab correcto.
- Que `GITLAB_MIRROR_TOKEN` no esté vencido y tenga permiso `write_repository`.
- Que `GITLAB_MIRROR_USERNAME` coincida con el usuario asociado al token o esté vacío para usar `lu-developer476`.
- Que el branch destino no esté protegido en GitLab de una forma que bloquee pushes del token. Si el branch está protegido, permitir pushes para el usuario/token del mirror o ajustar las reglas de protección del branch en GitLab.
- Que no existan hooks, reglas de aprobación o políticas de GitLab que impidan actualizaciones con `--force-with-lease`.

## Notas operativas

- GitHub es la fuente de verdad para los branches y tags replicados.
- Evitar commits directos en GitLab sobre branches replicados, porque el siguiente mirror puede reemplazarlos con el estado de GitHub.
- Git LFS no se descarga durante el checkout del workflow.
