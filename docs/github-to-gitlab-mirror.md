# Mirror automático de GitHub a GitLab

Este repositorio incluye un workflow de GitHub Actions que replica `main` hacia el repositorio existente de GitLab cada vez que `main` recibe un `push`. En la práctica, cuando se mergea un Pull Request en GitHub, GitHub Actions empuja ese mismo commit a GitLab y Render puede desplegar desde el repositorio que ya tiene conectado.

## Workflow

El workflow está en `.github/workflows/mirror-to-gitlab.yml` y se ejecuta en estos casos:

- `push` a `main`, incluyendo merges de Pull Requests.
- Ejecución manual desde la pestaña **Actions** con `workflow_dispatch`.

La acción hace checkout con historial completo, agrega el remoto de GitLab por HTTPS, verifica que el repositorio remoto exista y luego ejecuta:

```bash
git push gitlab +HEAD:${target_branch}
```

El `+` es intencional: GitHub queda como fuente de verdad y el branch de GitLab se actualiza aunque el repositorio GitLab existente tenga historia vieja, divergente o creada antes del mirror. Esto evita el problema típico de un mirror que falla porque GitLab no comparte exactamente el mismo historial que GitHub.

## Secretos requeridos en GitHub

Configurar en **GitHub → Settings → Secrets and variables → Actions → Repository secrets**:

| Secreto | Requerido | Descripción |
| --- | --- | --- |
| `GITLAB_MIRROR_URL` | Sí | URL HTTPS del repositorio GitLab existente, sin credenciales. Ejemplo: `https://gitlab.com/grupo/no-way-down.git`. |
| `GITLAB_MIRROR_TOKEN` | Sí | Personal Access Token o Project Access Token de GitLab con permiso de escritura sobre el repositorio. |
| `GITLAB_MIRROR_USERNAME` | No | Usuario para autenticar contra GitLab. Si se omite, se usa `oauth2`, que funciona con tokens HTTPS de GitLab. |
| `GITLAB_MIRROR_BRANCH` | No | Branch destino en GitLab. Si se omite, se usa `main`. Configurarlo solo si Render deploya desde otro branch, por ejemplo `master`. |

## Configuración recomendada en GitLab y Render

1. Usar el repositorio GitLab de No Way Down que Render ya tiene conectado.
2. Crear en GitLab un token con permisos para hacer `push` a ese repositorio.
3. Cargar los secretos anteriores en GitHub.
4. Verificar que Render esté conectado al mismo branch que usa `GITLAB_MIRROR_BRANCH` o, si no se configura ese secreto, a `main`.
5. Ejecutar manualmente el workflow **Mirror to GitLab** una primera vez para alinear el repositorio GitLab existente con GitHub.
6. Confirmar que GitLab recibió el commit y que Render inició el deploy.
7. A partir de ahí, mergear Pull Requests en GitHub normalmente; cada merge vuelve a disparar el mirror.

## Notas operativas

- El mirror asume que GitHub es la fuente de verdad para el branch de despliegue.
- Evitar commits directos en el branch conectado a Render dentro de GitLab, porque el siguiente mirror los reemplazará con el estado de GitHub.
- Si el branch de producción en GitLab no se llama `main`, definir `GITLAB_MIRROR_BRANCH` con el nombre correspondiente en vez de editar el workflow.
